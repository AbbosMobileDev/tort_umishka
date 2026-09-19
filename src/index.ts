import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { webhookCallback } from 'grammy';
import { config, log } from './config.js';
import { createBot, setBotCommands, setMenuButton } from './bot/index.js';
import { initSchema } from './db/init.js';
import { listActiveShops, updateShop } from './db/repo.js';
import { runSeed } from './db/seed.js';
import { startJobs } from './jobs/index.js';
import { createWebHandler } from './web/server.js';
import { miniAppUrl } from './web/url.js';

async function main(): Promise<void> {
  if (!config.botToken) {
    log.error('BOT_TOKEN yo\'q. .env faylini to\'ldiring (.env.example dan nusxa oling).');
    process.exit(1);
  }

  await initSchema();

  let shops = await listActiveShops();
  if (!shops.length) {
    // Serverda yangi baza bo'sh bo'ladi va konsol yo'q — katalog o'zi yaratiladi.
    log.info('Baza bo\'sh — namunaviy katalog yaratilmoqda...');
    await runSeed({ closeDb: false });
    shops = await listActiveShops();
  }
  if (!shops.length) {
    log.error('Do\'kon yaratilmadi. `npm run seed` ni qo\'lda bajaring.');
    process.exit(1);
  }

  // v0.1: bitta do'kon, token .env dan. Ko'p do'kon bo'lganda tokenlar bazadan olinadi.
  const shop = shops[0];

  // .env dagi admin sozlamalari bazaga sinxronlanadi
  const patch: Record<string, unknown> = {};
  if (config.adminGroupId && config.adminGroupId !== shop.adminGroupId) {
    patch.admin_group_id = config.adminGroupId;
  }
  if (config.adminUserId && !shop.adminUserIds.includes(config.adminUserId)) {
    patch.admin_user_ids = [...shop.adminUserIds, config.adminUserId];
  }
  if (Object.keys(patch).length) {
    await updateShop(shop.id, patch);
    log.info('Admin sozlamalari .env dan yangilandi');
  }

  const bot = createBot(shop, config.botToken);
  await setBotCommands(bot, shop);
  await setMenuButton(bot, shop, miniAppUrl());
  startJobs(shop.timezone);

  /** Polling: bot Telegramga o'zi ulanadi, tashqaridan ochiq manzil kerak emas. */
  const startPolling = async () => {
    await bot.api.deleteWebhook({ drop_pending_updates: false }).catch(() => undefined);
    log.info(`Bot polling rejimida ishga tushmoqda — do'kon: ${shop.name}`);
    void bot
      .start({ onStart: (me) => log.info(`Ulandi: @${me.username}`) })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('401')) {
          log.error('BOT_TOKEN noto\'g\'ri. BotFather bergan tokenni .env ga to\'g\'ri ko\'chiring.');
        } else {
          log.error('Polling to\'xtadi', msg);
        }
      });
  };

  const path = `/webhook/${shop.id}`;
  // Webhook manzili ochiq, shuning uchun Telegram har so'rovga shu maxfiy sarlavhani
  // qo'shadi — begona POST so'rovlar soxta buyurtma yarata olmaydi.
  const secretToken = createHash('sha256').update(config.botToken).digest('hex');
  // Handler faqat haqiqiy webhook uchun yaratiladi: grammY webhookCallback'dan keyin
  // bot.start() ni taqiqlaydi, biz esa WEBHOOK_URL bo'lmasa polling'ga tushamiz.
  const handler =
    config.mode === 'webhook' && config.webhookUrl
      ? webhookCallback(bot, 'http', { secretToken })
      : null;
  // Mini App shu serverning o'zidan beriladi: statik sahifa va `/api/*`.
  const web = createWebHandler({ shopId: shop.id, botToken: config.botToken });

  const server = createServer((req, res) => {
    if (handler && req.url === path && req.method === 'POST') {
      void handler(req, res);
      return;
    }
    void web(req, res)
      .then((handled) => {
        if (handled) return;
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok'); // health check
      })
      .catch((e: unknown) => {
        log.error('HTTP xatosi', e instanceof Error ? e.message : e);
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
  });

  // Server polling rejimida ham ko'tariladi: mini app'ni lokal tunnel (ngrok va sh.k.)
  // orqali sinab ko'rish uchun kerak.
  server.listen(config.port, async () => {
    log.info(`HTTP server: ${config.port}, webhook path: ${path}`);
    const app = miniAppUrl();
    log.info(app ? `Mini App: ${app}` : 'Mini App manzili yo\'q — bot oddiy oqimda ishlaydi.');

    if (config.mode !== 'webhook') {
      await startPolling();
      return;
    }
    // Birinchi deploy'da servis manzili hali ma'lum emas, ya'ni WEBHOOK_URL bo'sh
    // bo'ladi. Bunda yiqilmaymiz: port band qilinadi (health check o'tadi) va bot
    // vaqtincha polling'da ishlaydi. WEBHOOK_URL qo'yilgach webhook'ka o'tadi.
    if (!config.webhookUrl) {
      log.warn('WEBHOOK_URL hali qo\'yilmagan — vaqtincha polling rejimida ishlayapman.');
      log.warn('Servis manzilini WEBHOOK_URL ga qo\'ying va qayta deploy qiling.');
      await startPolling();
      return;
    }
    await bot.api.setWebhook(`${config.webhookUrl.replace(/\/$/, '')}${path}`, {
      secret_token: secretToken,
      drop_pending_updates: false,
    });
    log.info('Webhook o\'rnatildi');
  });

  const stop = async () => {
    log.info('To\'xtatilmoqda...');
    try {
      await bot.stop();
    } catch {
      /* polling qayta urinish holatida bo'lishi mumkin */
    }
    process.exit(0);
  };
  process.once('SIGINT', () => void stop());
  process.once('SIGTERM', () => void stop());
}

main().catch((e) => {
  log.error('Ishga tushirishda xato', e);
  process.exit(1);
});
