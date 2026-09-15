process.env.DATABASE_URL = '';
process.env.LOCAL_DB_PATH = 'memory://';

import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { initSchema } from '../src/db/init.js';
import { getDb, num } from '../src/db/pool.js';
import {
  SlotTakenError,
  createHold,
  createOrder,
  getUsage,
  listCategories,
  listProducts,
  upsertCustomer,
} from '../src/db/repo.js';
import { addDays, todayInTz } from '../src/services/dates.js';

const TZ = 'Asia/Tashkent';

async function fixture() {
  await initSchema();
  const db = await getDb();
  const shop = await db.query(
    `INSERT INTO shops (name, daily_capacity_kg, daily_capacity_orders)
     VALUES ('Test do''kon', 10, 2) RETURNING id`,
  );
  const shopId = num(shop[0].id);
  const cat = await db.query(
    `INSERT INTO categories (shop_id, name) VALUES ($1, 'Tortlar') RETURNING id`,
    [shopId],
  );
  const catId = num(cat[0].id);
  await db.query(
    `INSERT INTO products (shop_id, category_id, name, price_per_kg) VALUES ($1, $2, 'Napoleon', 85000)`,
    [shopId, catId],
  );
  return { shopId, catId };
}

const baseOrder = (shopId: number, customerId: number, tgId: number, date: string, kg: number) => ({
  shopId,
  customerId,
  telegramUserId: tgId,
  productSnapshot: { name: 'Napoleon', pricePerKg: 85_000 },
  optionsSnapshot: [],
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
  capacityKg: 10,
  capacityOrders: 2,
});

test('sxema yaratiladi va katalog o\'qiladi', async () => {
  const { shopId } = await fixture();
  const cats = await listCategories(shopId);
  assert.equal(cats.length, 1);
  const products = await listProducts(shopId, cats[0].id);
  assert.equal(products[0].name, 'Napoleon');
  assert.equal(products[0].pricePerKg, 85_000);
  assert.deepEqual(products[0].weightOptions, [1, 1.5, 2, 3, 4, 5]);
});

test('buyurtma yaratiladi, raqamlanadi va band joyni oshiradi', async () => {
  const db = await getDb();
  const shopId = num((await db.query(`SELECT id FROM shops LIMIT 1`))[0].id);
  const date = addDays(todayInTz(TZ), 3);
  const c1 = await upsertCustomer(shopId, 111, 'Dilshod');

  const o1 = await createOrder(baseOrder(shopId, c1.id, 111, date, 3));
  assert.equal(o1.orderNumber, 1);
  assert.equal(o1.status, 'AWAITING_PAYMENT');
  assert.equal(o1.weightKg, 3);
  assert.equal(o1.pickupDate, date);

  const usage = (await getUsage(shopId, date, date)).get(date);
  assert.equal(usage?.usedKg, 3);
  assert.equal(usage?.usedOrders, 1);
});

test('kunlik buyurtma limiti oshib ketmaydi', async () => {
  const db = await getDb();
  const shopId = num((await db.query(`SELECT id FROM shops LIMIT 1`))[0].id);
  const date = addDays(todayInTz(TZ), 3);
  const c2 = await upsertCustomer(shopId, 222, 'Nодira');
  const c3 = await upsertCustomer(shopId, 333, 'Aziz');

  await createOrder(baseOrder(shopId, c2.id, 222, date, 2)); // 2-buyurtma (limit 2)
  await assert.rejects(
    () => createOrder(baseOrder(shopId, c3.id, 333, date, 1)),
    (e: unknown) => e instanceof SlotTakenError,
  );
});

test('boshqa mijozning aktiv rezervi joyni band qiladi', async () => {
  const db = await getDb();
  const shopId = num((await db.query(`SELECT id FROM shops LIMIT 1`))[0].id);
  const date = addDays(todayInTz(TZ), 5);
  const c4 = await upsertCustomer(shopId, 444, 'Kamola');
  const c5 = await upsertCustomer(shopId, 555, 'Sardor');

  await createHold(shopId, 444, date, 9, 15);
  const usage = (await getUsage(shopId, date, date, 555)).get(date);
  assert.equal(usage?.usedKg, 9);

  // 555 uchun 2 kg sig'maydi (9 + 2 > 10)
  await assert.rejects(
    () => createOrder(baseOrder(shopId, c5.id, 555, date, 2)),
    (e: unknown) => e instanceof SlotTakenError,
  );
  // rezerv egasining o'zi esa 1 kg ola oladi
  const ok = await createOrder(baseOrder(shopId, c4.id, 444, date, 1));
  assert.equal(ok.weightKg, 1);
});

after(async () => {
  const db = await getDb();
  await db.close();
});
