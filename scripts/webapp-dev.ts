/**
 * Mini App ni Telegramsiz ochib ko'rish uchun server (`npm run dev:app`).
 *
 * Bot ishga tushmaydi — ya'ni ishlab turgan webhook buzilmaydi. initData imzosi
 * o'rniga WEBAPP_DEV_USER_ID ishlatiladi, shuning uchun sahifani oddiy brauzerda
 * ham ochsa bo'ladi. Serverda bu yo'l yopiq: u faqat polling rejimida ishlaydi.
 */
process.env.BOT_MODE = 'polling';
process.env.WEBAPP_DEV_USER_ID = process.env.WEBAPP_DEV_USER_ID || '1';

const { createServer } = await import('node:http');
const { config, log } = await import('../src/config.js');
const { initSchema } = await import('../src/db/init.js');
const { listActiveShops } = await import('../src/db/repo.js');
const { runSeed } = await import('../src/db/seed.js');
const { createWebHandler } = await import('../src/web/server.js');

await initSchema();
let shops = await listActiveShops();
if (!shops.length) {
  log.info('Baza bo\'sh — namunaviy katalog yaratilmoqda...');
  await runSeed({ closeDb: false });
  shops = await listActiveShops();
}
const shop = shops[0];

const handler = createWebHandler({ shopId: shop.id, botToken: config.botToken });
const port = Number(process.env.PORT || 3000);

createServer((req, res) => {
  void handler(req, res)
    .then((handled) => {
      if (handled) return;
      res.writeHead(404).end();
    })
    .catch((e: unknown) => {
      log.error('HTTP xatosi', e instanceof Error ? e.message : e);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
}).listen(port, () => {
  log.info(`Mini App: http://localhost:${port} — do'kon: ${shop.name}`);
  log.info(`Test foydalanuvchi ID: ${process.env.WEBAPP_DEV_USER_ID}`);
});
