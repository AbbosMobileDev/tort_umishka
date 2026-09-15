/**
 * Admin panelni Telegramsiz tekshirish: soxta update'lar haqiqiy handlerlardan
 * o'tkaziladi va bot yuboradigan xabarlar terminalga chiqadi.
 * Baza — xotirada, hech narsa saqlanmaydi.  `npm run smoke:panel`
 */
process.env.DATABASE_URL = '';
process.env.LOCAL_DB_PATH = 'memory://';
process.env.LOG_LEVEL = 'error';

import { initSchema } from '../src/db/init.js';
import { getDb, num } from '../src/db/pool.js';
import { createBot } from '../src/bot/index.js';
import { createOrder, getShop, upsertCustomer, listAllProducts, getProduct } from '../src/db/repo.js';
import { addDays, todayInTz } from '../src/services/dates.js';
import { notifyAdminNewOrder } from '../src/services/notify.js';
import { at } from '../src/texts/admin-uz.js';

const ADMIN = 555000111;
const TZ = 'Asia/Tashkent';

await initSchema();
const db = await getDb();
const shopId = num(
  (
    await db.query(
      `INSERT INTO shops (name, admin_user_ids, admin_group_id, payment_card)
       VALUES ('Umidaxonim shirinliklari', ARRAY[$1::bigint], -100999, '8600...') RETURNING id`,
      [ADMIN],
    )
  )[0].id,
);
const catId = num(
  (await db.query(`INSERT INTO categories (shop_id, name) VALUES ($1,'Tortlar') RETURNING id`, [shopId]))[0].id,
);
const prodId = num(
  (
    await db.query(
      `INSERT INTO products (shop_id, category_id, name, price_per_kg) VALUES ($1,$2,'Napoleon',85000) RETURNING id`,
      [shopId, catId],
    )
  )[0].id,
);
await db.query(
  `INSERT INTO product_options (shop_id, product_id, group_name, option_name, extra_price, price_type)
   VALUES ($1,$2,'Ichlik','Klassik',0,'fixed')`,
  [shopId, prodId],
);

const shop = (await getShop(shopId))!;
const customer = await upsertCustomer(shopId, 777001, 'Dilshod');
await db.query(`UPDATE customers SET phone='+998901234567' WHERE id=$1`, [customer.id]);
const order = await createOrder({
  shopId,
  customerId: customer.id,
  telegramUserId: 777001,
  productSnapshot: { name: 'Napoleon', pricePerKg: 85_000 },
  optionsSnapshot: [{ groupName: 'Ichlik', optionName: 'Klassik', price: 0 }],
  weightKg: 3,
  inscriptionText: 'Dilnoza 25 yosh',
  deliveryType: 'delivery',
  addressText: 'Chilonzor 7-kvartal',
  addressNote: null,
  lat: null,
  lng: null,
  pickupDate: addDays(todayInTz(TZ), 2),
  pickupTimeSlot: '14:00-16:00',
  subtotal: 255_000,
  deliveryFee: 20_000,
  total: 275_000,
  prepaidAmount: 110_000,
  remainingAmount: 165_000,
  capacityKg: 25,
  capacityOrders: 8,
});

const bot = createBot(shop, '123:FAKE');
bot.botInfo = {
  id: 123,
  is_bot: true,
  first_name: 'TortBot',
  username: 'tortbot',
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business_account: false,
  has_main_web_app: false,
};

let msgId = 100;
const out: string[] = [];
bot.api.config.use(async (_prev, method, payload: any) => {
  const p = payload as any;
  if (method === 'sendMessage' || method === 'editMessageText') {
    const kb = (p.reply_markup?.inline_keyboard ?? [])
      .map((row: any[]) => row.map((b) => `[${b.text}]`).join(' '))
      .join('\n');
    const rk = p.reply_markup?.keyboard
      ? '\n  (menyu: ' + p.reply_markup.keyboard.flat().map((b: any) => b.text).join(' | ') + ')'
      : '';
    out.push(
      `${method === 'editMessageText' ? '✎ TAHRIR' : '→ XABAR'} chat=${p.chat_id ?? '-'}\n${p.text}${kb ? '\n' + kb : ''}${rk}\n`,
    );
  } else if (method === 'sendDocument') {
    const f: any = p.document;
    out.push(`→ FAYL chat=${p.chat_id} nomi=${f?.filename}\n  caption: ${p.caption}\n`);
  } else if (method === 'answerCallbackQuery') {
    out.push(`  ⤷ javob: ${p.text ?? '(bo\'sh)'}`);
  } else {
    out.push(`→ ${method} ${JSON.stringify(p).slice(0, 120)}`);
  }
  return { ok: true, result: { message_id: ++msgId, date: 0, chat: { id: p.chat_id, type: 'private' }, text: p.text } } as any;
});

let uid = 1;
const from = { id: ADMIN, is_bot: false, first_name: 'Umida' };
async function text(s: string) {
  out.push(`\n=== ADMIN yozdi: "${s}"`);
  await bot.handleUpdate({
    update_id: uid++,
    message: {
      message_id: uid,
      date: 0,
      chat: { id: ADMIN, type: 'private' },
      from,
      text: s,
      entities: s.startsWith('/') ? [{ type: 'bot_command', offset: 0, length: s.length }] : undefined,
    },
  } as any);
}
async function photo() {
  out.push(`\n=== ADMIN rasm yubordi`);
  await bot.handleUpdate({
    update_id: uid++,
    message: {
      message_id: uid,
      date: 0,
      chat: { id: ADMIN, type: 'private' },
      from,
      photo: [{ file_id: 'PHOTO_FILE_ID', file_unique_id: 'u', width: 100, height: 100 }],
    },
  } as any);
}
async function click(data: string) {
  out.push(`\n=== ADMIN bosdi: ${data}`);
  await bot.handleUpdate({
    update_id: uid++,
    callback_query: {
      id: String(uid),
      from,
      chat_instance: 'ci',
      data,
      message: { message_id: 500, date: 0, chat: { id: ADMIN, type: 'private' }, text: 'eski' },
    },
  } as any);
}

async function groupText(str: string) {
  out.push(`\n=== GURUHDA yozildi: "${str}"`);
  await bot.handleUpdate({
    update_id: uid++,
    message: {
      message_id: uid,
      date: 0,
      chat: { id: -100999, type: 'supergroup' },
      from,
      text: str,
      entities: [{ type: 'bot_command', offset: 0, length: str.length }],
    },
  } as any);
}

out.push('\n=== YANGI BUYURTMA TUSHDI (guruh + admin shaxsiy chati)');
await notifyAdminNewOrder(order);

await text('/start');
await text(at.btnOrders);
await click('p:ord:new');
await click(`p:o:${order.id}:new`);
await click(`p:pay:${order.id}:ok:new`);
await click(`p:st:${order.id}:ACCEPTED:new`);
await text(at.btnCatalog);
await click(`a:prod:${prodId}`);
await click(`a:avail:${prodId}`);
await click('p:new');
await text('Pista tort');
await click(`p:newcat:${catId}`);
await photo();
await text('120000');
await click(`p:del:${(await listAllProducts(shopId)).find((p) => p.name === 'Pista tort')!.id}`);
await click(`p:delok:${(await listAllProducts(shopId)).find((p) => p.name === 'Pista tort')!.id}`);
await text(at.btnReport);
await click('p:rep:next');
await click('p:csv:next');
await text(at.btnSettings);
await click('p:block');
await text('2026-12-31');
await text(at.btnCustomerMode);
await groupText('/bugun');
await groupText('/menu');

console.log(out.join('\n'));
console.log('\n--- yakuniy katalog:', (await listAllProducts(shopId)).map((p) => `${p.name}(${p.isAvailable ? 'sotuvda' : 'o\'chirilgan'})`).join(', '));
console.log('--- Napoleon holati:', (await getProduct(shopId, prodId))!.isAvailable);
await db.close();
process.exit(0);
