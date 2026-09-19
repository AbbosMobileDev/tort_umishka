import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { log } from '../config.js';
import { bots } from '../bot/context.js';
import { getProduct } from '../db/repo.js';
import { w } from '../texts/webapp-uz.js';
import {
  ApiError,
  availableDates,
  bootstrap,
  cancelHold,
  myOrders,
  quote,
  savePhone,
  submitOrder,
  type ApiUser,
} from './api.js';
import { authenticate } from './auth.js';

const PUBLIC_DIR = resolve(process.cwd(), 'public');
const ASSETS_DIR = resolve(process.cwd(), 'assets');
const MAX_BODY_BYTES = 64 * 1024;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(json);
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new ApiError(w.errorGeneric, 413));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolvePromise({});
      try {
        resolvePromise(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new ApiError(w.errorGeneric));
      }
    });
    req.on('error', reject);
  });
}

/** `..` bilan public/assets tashqarisiga chiqib bo'lmasin. */
function safeJoin(root: string, urlPath: string): string | null {
  const clean = normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, '');
  const full = join(root, clean);
  return full === root || full.startsWith(root + sep) ? full : null;
}

async function serveFile(res: ServerResponse, path: string, cache: string): Promise<boolean> {
  try {
    const info = await stat(path);
    if (!info.isFile()) return false;
    res.writeHead(200, {
      'Content-Type': MIME[extname(path).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': cache,
    });
    createReadStream(path).pipe(res);
    return true;
  } catch {
    return false;
  }
}

/** file_id -> Telegram serveridagi yo'l. getFile ni har safar chaqirmaslik uchun. */
const filePathCache = new Map<string, string>();

/**
 * Mahsulot rasmi. Diskdagi fayl ustun turadi; faqat `photo_file_id` bo'lsa (admin
 * panel orqali qo'shilgan mahsulot) rasm Telegramdan olib beriladi — brauzer
 * Telegram fayl manzilidagi tokenni ko'rmaydi.
 */
async function servePhoto(
  shopId: number,
  productId: number,
  res: ServerResponse,
  botToken: string,
): Promise<boolean> {
  const product = await getProduct(shopId, productId);
  if (!product) return false;

  if (product.photoPath) {
    const path = resolve(process.cwd(), product.photoPath);
    if (await serveFile(res, path, 'public, max-age=86400')) return true;
  }
  if (!product.photoFileId) return false;

  try {
    let filePath = filePathCache.get(product.photoFileId);
    if (!filePath) {
      const bot = bots.get(shopId);
      if (!bot) return false;
      const file = await bot.api.getFile(product.photoFileId);
      if (!file.file_path) return false;
      filePath = file.file_path;
      filePathCache.set(product.photoFileId, filePath);
    }
    const upstream = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
    if (!upstream.ok || !upstream.body) {
      filePathCache.delete(product.photoFileId);
      return false;
    }
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath).toLowerCase()] ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
    });
    Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
    return true;
  } catch (e) {
    log.warn('Rasm berilmadi', e instanceof Error ? e.message : e);
    return false;
  }
}

/* ------------------------------------------------------------------ router */

export interface WebHandlerOptions {
  shopId: number;
  botToken: string;
}

/**
 * Mini App uchun HTTP yo'llari. `true` qaytsa so'rov shu yerda yakunlangan,
 * `false` bo'lsa chaqiruvchi (webhook serveri) o'zi javob beradi.
 */
export function createWebHandler(
  opts: WebHandlerOptions,
): (req: IncomingMessage, res: ServerResponse) => Promise<boolean> {
  return async function handle(req, res) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;
    const method = req.method ?? 'GET';

    if (method === 'GET' && (path === '/' || path === '/index.html')) {
      return serveFile(res, join(PUBLIC_DIR, 'index.html'), 'no-cache');
    }

    if (method === 'GET' && path.startsWith('/media/')) {
      const file = safeJoin(ASSETS_DIR, path.slice('/media'.length));
      return file ? serveFile(res, file, 'public, max-age=86400') : false;
    }

    if (method === 'GET' && !path.startsWith('/api/') && !path.startsWith('/webhook/')) {
      // Deploy'dan keyin mijozda eski app.js qolib ketmasin: har safar tekshiriladi.
      const file = safeJoin(PUBLIC_DIR, path);
      if (file && (await serveFile(res, file, 'no-cache'))) return true;
      return false;
    }

    if (!path.startsWith('/api/')) return false;

    const photo = /^\/api\/photo\/(\d+)$/.exec(path);
    if (method === 'GET' && photo) {
      const ok = await servePhoto(opts.shopId, Number(photo[1]), res, opts.botToken);
      if (ok) return true;
      res.writeHead(404).end();
      return true;
    }

    const initData = req.headers['x-init-data'];
    const user = authenticate(typeof initData === 'string' ? initData : undefined, opts.botToken);
    if (!user) {
      sendJson(res, 401, { error: w.errorAuth });
      return true;
    }

    try {
      const result = await route(opts.shopId, user, method, path, url, req);
      if (result === undefined) {
        sendJson(res, 404, { error: w.errorGeneric });
        return true;
      }
      sendJson(res, 200, result);
    } catch (e) {
      if (e instanceof ApiError) {
        sendJson(res, e.status, { error: e.message, code: e.code });
      } else {
        log.error('Mini App API xatosi', e instanceof Error ? e.message : e);
        sendJson(res, 500, { error: w.errorGeneric });
      }
    }
    return true;
  };
}

async function route(
  shopId: number,
  user: ApiUser,
  method: string,
  path: string,
  url: URL,
  req: IncomingMessage,
): Promise<unknown> {
  if (method === 'GET' && path === '/api/bootstrap') return bootstrap(shopId, user);
  if (method === 'GET' && path === '/api/orders') return myOrders(shopId, user);
  if (method === 'GET' && path === '/api/dates') {
    return availableDates(shopId, user, Number(url.searchParams.get('kg')));
  }
  if (method === 'POST' && path === '/api/quote') {
    return quote(shopId, user, (await readBody(req)) as Record<string, unknown>);
  }
  if (method === 'POST' && path === '/api/order') {
    return submitOrder(shopId, user, (await readBody(req)) as Record<string, unknown>);
  }
  if (method === 'POST' && path === '/api/phone') {
    return savePhone(shopId, user, (await readBody(req)) as { phone?: unknown });
  }
  if (method === 'POST' && path === '/api/hold/cancel') return cancelHold(shopId, user);
  return undefined;
}
