import { createHmac, timingSafeEqual } from 'node:crypto';
import { config, log } from '../config.js';

export interface WebAppUser {
  id: number;
  firstName: string | null;
  username: string | null;
}

/** initData eskirgan hisoblanadigan muddat (Telegram tavsiyasi — 24 soat). */
const MAX_AGE_SECONDS = 24 * 3600;

function equalHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

export type InitDataFailure =
  | 'empty'
  | 'no_hash'
  | 'bad_hash'
  | 'expired'
  | 'no_user'
  | 'bad_user';

export type InitDataResult =
  | { ok: true; user: WebAppUser }
  | { ok: false; reason: InitDataFailure };

/**
 * `hash` ni tekshiradi.
 *
 * Yangi Telegram mijozlari `initData` ga `signature` maydonini ham qo'shadi (uchinchi
 * tomon uchun Ed25519 imzosi). Hujjatga ko'ra HMAC `hash` dan faqat `hash` ning o'zi
 * chiqariladi, ya'ni `signature` hisobga kiradi — lekin ba'zi mijozlar aksincha
 * qiladi. Shuning uchun ikkala variant ham sinaladi: bittasi mos kelsa yetarli.
 * Ikkalasi ham bir xil maxfiy kalit bilan hisoblangani uchun bu xavfsizlikni
 * pasaytirmaydi.
 */
function hashMatches(params: URLSearchParams, hash: string, botToken: string): boolean {
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  for (const skipSignature of [false, true]) {
    const pairs: string[] = [];
    for (const [key, value] of params) {
      if (key === 'hash') continue;
      if (skipSignature && key === 'signature') continue;
      pairs.push(`${key}=${value}`);
    }
    pairs.sort();
    const computed = createHmac('sha256', secret).update(pairs.join('\n')).digest('hex');
    if (equalHex(computed, hash)) return true;
  }
  return false;
}

/**
 * Telegram WebApp `initData` ni tekshiradi (Telegram Bot API, "Validating data").
 *
 * Mini App brauzerda ishlaydi, ya'ni har qanday odam API ga so'rov yubora oladi.
 * Foydalanuvchi ID si faqat shu imzo tekshirilgandan keyin ishonchli bo'ladi —
 * boshqa hech qayerda `user.id` ga ishonmaymiz.
 *
 * Xato sababi ham qaytadi: log'da "imzo noto'g'ri" bilan "umuman kelmadi" ni
 * ajrata olish kerak (aks holda nosozlikni topib bo'lmaydi).
 */
export function checkInitData(initData: string, botToken: string): InitDataResult {
  if (!initData || !botToken) return { ok: false, reason: 'empty' };

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { ok: false, reason: 'no_hash' };
  if (!hashMatches(params, hash, botToken)) return { ok: false, reason: 'bad_hash' };

  const authDate = Number(params.get('auth_date') ?? 0);
  if (!Number.isFinite(authDate) || authDate <= 0) return { ok: false, reason: 'expired' };
  if (Date.now() / 1000 - authDate > MAX_AGE_SECONDS) return { ok: false, reason: 'expired' };

  const rawUser = params.get('user');
  if (!rawUser) return { ok: false, reason: 'no_user' };
  try {
    const user = JSON.parse(rawUser) as { id?: number; first_name?: string; username?: string };
    if (typeof user.id !== 'number') return { ok: false, reason: 'bad_user' };
    return {
      ok: true,
      user: {
        id: user.id,
        firstName: user.first_name ?? null,
        username: user.username ?? null,
      },
    };
  } catch {
    return { ok: false, reason: 'bad_user' };
  }
}

export function verifyInitData(initData: string, botToken: string): WebAppUser | null {
  const result = checkInitData(initData, botToken);
  return result.ok ? result.user : null;
}

/**
 * So'rovdan foydalanuvchini aniqlaydi.
 * Lokal test uchun (polling + WEBAPP_DEV_USER_ID) imzo talab qilinmaydi — serverda
 * BOT_MODE=webhook bo'lgani uchun bu yo'l yopiq.
 */
export function authenticate(initData: string | undefined, botToken: string): WebAppUser | null {
  const result = checkInitData(initData ?? '', botToken);
  if (result.ok) return result.user;

  if (config.mode === 'polling' && config.webappDevUserId) {
    return { id: config.webappDevUserId, firstName: null, username: null };
  }
  // Sabab log'ga chiqadi: 'empty' — sahifa Telegramdan tashqarida ochilgan,
  // 'bad_hash' — token mos emas yoki imzo buzilgan, 'expired' — eski sessiya.
  log.warn(`Mini App: initData tasdiqlanmadi (${result.reason})`);
  return null;
}
