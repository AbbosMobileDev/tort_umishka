import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { webhookCallback } from 'grammy';
import { config, log } from './config.js';
import { createBot, setBotCommands } from './bot/index.js';
import { initSchema } from './db/init.js';
import { listActiveShops, updateShop } from './db/repo.js';
import { runSeed } from './db/seed.js';
import { startJobs } from './jobs/index.js';

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
  startJobs(shop.timezone);

  if (config.mode === 'webhook') {
    if (!config.webhookUrl) {
      log.error('BOT_MODE=webhook uchun WEBHOOK_URL kerak.');
      process.exit(1);
    }
    const path = `/webhook/${shop.id}`;
    // Webhook manzili ochiq, shuning uchun Telegram har so'rovga shu maxfiy sarlavhani
    // qo'shadi — begona POST so'rovlar soxta buyurtma yarata olmaydi.
    const secretToken = createHash('sha256').update(config.botToken).digest('hex');
    const handler = webhookCallback(bot, 'http', { secretToken });
    const server = createServer((req, res) => {
      if (req.url === path && req.method === 'POST') {
        void handler(req, res);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok'); // health check
    });
    server.listen(config.port, async () => {
      log.info(`HTTP server: ${config.port}, webhook path: ${path}`);
      await bot.api.setWebhook(`${config.webhookUrl.replace(/\/$/, '')}${path}`, {
        secret_token: secretToken,
        drop_pending_updates: false,
      });
      log.info('Webhook o\'rnatildi');
    });
  } else {
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
  }

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
