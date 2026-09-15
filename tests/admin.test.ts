process.env.DATABASE_URL = '';
process.env.LOCAL_DB_PATH = 'memory://';

import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { initSchema } from '../src/db/init.js';
import { getDb, num } from '../src/db/pool.js';
import {
  copyCategoryOptions,
  countOrdersByStatus,
  createCategory,
  createOrder,
  createProduct,
  deleteProduct,
  listAllCategories,
  listAllProducts,
  listOrdersByStatuses,
  listOrdersInRange,
  listProductOptions,
  listProducts,
  setOrderStatus,
  upsertCustomer,
} from '../src/db/repo.js';
import { buildOrdersCsv, periodRange, summarize } from '../src/services/report.js';
import { addDays, todayInTz } from '../src/services/dates.js';
import type { Order } from '../src/types.js';

const TZ = 'Asia/Tashkent';
const TODAY = todayInTz(TZ);

let shopId = 0;
let catId = 0;

async function fixture() {
  await initSchema();
  const db = await getDb();
  const shop = await db.query(
    `INSERT INTO shops (name, daily_capacity_kg, daily_capacity_orders)
     VALUES ('Panel test', 100, 50) RETURNING id`,
  );
  shopId = num(shop[0].id);
  const cat = await createCategory(shopId, 'Tortlar');
  catId = cat.id;
  const napoleon = await createProduct(shopId, {
    categoryId: catId,
    name: 'Napoleon',
    pricePerKg: 85_000,
    photoFileId: null,
  });
  const db2 = await getDb();
  await db2.query(
    `INSERT INTO product_options (shop_id, product_id, group_name, option_name, extra_price, price_type)
     VALUES ($1, $2, 'Ichlik', 'Klassik', 0, 'fixed'), ($1, $2, 'Ichlik', 'Pista', 15000, 'per_kg')`,
    [shopId, napoleon.id],
  );
}

const order = (customerId: number, tgId: number, date: string, kg: number, name = 'Napoleon') => ({
  shopId,
  customerId,
  telegramUserId: tgId,
  productSnapshot: { name, pricePerKg: 85_000 },
  optionsSnapshot: [{ groupName: 'Ichlik', optionName: 'Klassik', price: 0 }],
  weightKg: kg,
  inscriptionText: null,
  deliveryType: 'pickup' as const,
  addressText: null,
  addressNote: null,
  lat: null,
  lng: null,
  pickupDate: date,
  pickupTimeSlot: '10:00-12:00',
  subtotal: 85_000 * kg,
  deliveryFee: 0,
  total: 85_000 * kg,
  prepaidAmount: 34_000,
  remainingAmount: 85_000 * kg - 34_000,
  capacityKg: 100,
  capacityOrders: 50,
});

test('admin katalogga mahsulot qo\'shadi, variantlar kategoriyadan nusxalanadi', async () => {
  await fixture();
  const product = await createProduct(shopId, {
    categoryId: catId,
    name: 'Pista tort',
    pricePerKg: 120_000,
    photoFileId: 'AgAC-test-file-id',
  });
  assert.equal(product.pricePerKg, 120_000);
  assert.equal(product.isAvailable, true, 'yangi mahsulot darrov sotuvda bo\'lsin');
  assert.equal(product.photoFileId, 'AgAC-test-file-id');

  const copied = await copyCategoryOptions(shopId, catId, product.id);
  assert.equal(copied, 2);
  const options = await listProductOptions(shopId, product.id);
  assert.deepEqual(
    options.map((o) => o.optionName),
    ['Klassik', 'Pista'],
  );
  assert.equal(options[1].priceType, 'per_kg');
});

test('mahsulot o\'chirilganda variantlari ham ketadi, boshqa do\'kon tegmaydi', async () => {
  const db = await getDb();
  const other = num(
    (await db.query(`INSERT INTO shops (name) VALUES ('Boshqa do''kon') RETURNING id`))[0].id,
  );
  const otherCat = await createCategory(other, 'Tortlar');
  const otherProduct = await createProduct(other, {
    categoryId: otherCat.id,
    name: 'Napoleon',
    pricePerKg: 70_000,
    photoFileId: null,
  });

  const [, pista] = await listAllProducts(shopId);
  // boshqa do'kon o'sha id bilan o'chira olmaydi
  assert.equal(await deleteProduct(other, pista.id), false);
  assert.equal(await deleteProduct(shopId, pista.id), true);

  assert.deepEqual(
    (await listAllProducts(shopId)).map((p) => p.name),
    ['Napoleon'],
  );
  assert.equal((await listProductOptions(shopId, pista.id)).length, 0);
  assert.equal((await listAllProducts(other))[0].id, otherProduct.id);
});

test('sotuvdan olingan mahsulot mijozga ko\'rinmaydi, adminga ko\'rinadi', async () => {
  const db = await getDb();
  await db.query(`UPDATE products SET is_available = FALSE WHERE shop_id = $1`, [shopId]);
  assert.equal((await listProducts(shopId, catId)).length, 0);
  assert.equal((await listProducts(shopId, catId, false)).length, 1);
  assert.equal((await listAllProducts(shopId)).length, 1);
  await db.query(`UPDATE products SET is_available = TRUE WHERE shop_id = $1`, [shopId]);
  assert.equal((await listAllCategories(shopId)).length, 1);
});

test('panel ro\'yxatlari holat bo\'yicha filtrlanadi', async () => {
  const c1 = await upsertCustomer(shopId, 901, 'Dilshod');
  const c2 = await upsertCustomer(shopId, 902, 'Nodira');
  const fresh = await createOrder(order(c1.id, 901, addDays(TODAY, 2), 2));
  const working = await createOrder(order(c2.id, 902, addDays(TODAY, 1), 3, 'Medovik'));
  await setOrderStatus(shopId, working.id, 'ACCEPTED', 'admin', 5);

  const isNew = await listOrdersByStatuses(shopId, ['AWAITING_PAYMENT', 'CONFIRMED'], 'recent');
  assert.deepEqual(
    isNew.map((o) => o.id),
    [fresh.id],
  );
  const active = await listOrdersByStatuses(shopId, ['ACCEPTED', 'BAKING', 'READY', 'DELIVERING']);
  assert.deepEqual(
    active.map((o) => o.id),
    [working.id],
  );
  assert.equal(isNew[0].customerName, 'Dilshod', 'kartada mijoz ismi bo\'lsin');

  const counts = await countOrdersByStatus(shopId);
  assert.equal(counts.AWAITING_PAYMENT, 1);
  assert.equal(counts.ACCEPTED, 1);

  // boshqa do'konning ro'yxati bo'sh
  const other = num((await getDb().then((d) => d.query(`SELECT id FROM shops ORDER BY id DESC LIMIT 1`)))[0].id);
  assert.equal((await listOrdersByStatuses(other, ['AWAITING_PAYMENT'])).length, 0);
});

test('hisobot davri sana oralig\'iga aylanadi', () => {
  assert.deepEqual(periodRange('today', '2026-09-15', 30), { from: '2026-09-15', to: '2026-09-15' });
  assert.deepEqual(periodRange('week', '2026-09-15', 30), { from: '2026-09-09', to: '2026-09-15' });
  assert.deepEqual(periodRange('month', '2026-03-01', 30), { from: '2026-01-31', to: '2026-03-01' });
  assert.deepEqual(periodRange('next', '2026-09-15', 7), { from: '2026-09-16', to: '2026-09-22' });
});

test('hisobot bekor qilinganlarni summaga qo\'shmaydi', async () => {
  const c3 = await upsertCustomer(shopId, 903, 'Aziz');
  const cancelled = await createOrder(order(c3.id, 903, addDays(TODAY, 2), 5));
  await setOrderStatus(shopId, cancelled.id, 'CANCELLED', 'admin', 5);

  const { from, to } = periodRange('next', TODAY, 30);
  const orders = await listOrdersInRange(shopId, from, to);
  assert.equal(orders.length, 3);

  const s = summarize(orders);
  assert.equal(s.orders, 2);
  assert.equal(s.cancelled, 1);
  assert.equal(s.kg, 5); // 2 + 3, bekor qilingan 5 kg hisobga olinmaydi
  assert.equal(s.som, 85_000 * 5);
  assert.equal(s.prepaid, 0, 'to\'lov tasdiqlanmagan — avans hisoblanmaydi');
  // teng bo'lganda alifbo tartibida
  assert.deepEqual(s.topProducts, [
    { name: 'Medovik', count: 1 },
    { name: 'Napoleon', count: 1 },
  ]);
});

test('CSV faylda har bir buyurtma bitta qator bo\'ladi', async () => {
  const orders = await listOrdersInRange(shopId, periodRange('next', TODAY, 30).from, addDays(TODAY, 30));
  const csv = buildOrdersCsv(orders);
  const lines = csv.split('\r\n').filter(Boolean);
  assert.equal(lines.length, orders.length + 1, 'sarlavha + buyurtmalar');
  assert.ok(csv.startsWith('﻿'), 'Excel uchun BOM');
  assert.ok(lines[0].startsWith('﻿Buyurtma;Olish sanasi;'));
  // qatorlar olish sanasi bo'yicha: eng yaqini birinchi
  assert.ok(lines[1].includes('Medovik'));
  assert.ok(lines[1].includes('Ichlik: Klassik'));
  assert.ok(csv.includes('Napoleon'));
});

test('CSV nuqta-vergul va qo\'shtirnoqni ekranlaydi', () => {
  const fake = {
    orderNumber: 7,
    status: 'READY',
    productSnapshot: { name: 'Tort "Aziz"; 3 kg', pricePerKg: 1 },
    optionsSnapshot: [],
    weightKg: 1,
    inscriptionText: null,
    deliveryType: 'pickup',
    addressText: null,
    addressNote: null,
    pickupDate: '2026-09-15',
    pickupTimeSlot: '10:00-12:00',
    total: 1,
    prepaidAmount: 0,
    remainingAmount: 1,
    paymentStatus: 'unpaid',
    customerName: null,
    customerPhone: null,
  } as unknown as Order;
  const row = buildOrdersCsv([fake]).split('\r\n')[1];
  assert.ok(row.includes('"Tort ""Aziz""; 3 kg"'));
});

after(async () => {
  const db = await getDb();
  await db.close();
});
