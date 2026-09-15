import { getDb, num, type Conn } from './pool.js';
import type {
  Category,
  Customer,
  CustomerState,
  Draft,
  Order,
  OrderStatus,
  Product,
  ProductOption,
  Session,
  Shop,
} from '../types.js';

/* ------------------------------------------------------------------ shops */

function mapShop(r: any): Shop {
  return {
    id: num(r.id),
    name: r.name,
    adminGroupId: r.admin_group_id === null ? null : num(r.admin_group_id),
    adminUserIds: (r.admin_user_ids ?? []).map(num),
    timezone: r.timezone,
    prepaymentPercent: num(r.prepayment_percent),
    deliveryFee: num(r.delivery_fee),
    inscriptionPrice: num(r.inscription_price),
    leadTimeHours: num(r.lead_time_hours),
    bookingHorizonDays: num(r.booking_horizon_days),
    dailyCapacityKg: num(r.daily_capacity_kg),
    dailyCapacityOrders: num(r.daily_capacity_orders),
    workingDays: (r.working_days ?? []).map(num),
    timeSlots: r.time_slots ?? [],
    paymentCard: r.payment_card,
    paymentCardHolder: r.payment_card_holder,
    contactPhone: r.contact_phone,
    isActive: r.is_active,
  };
}

export async function listActiveShops(): Promise<Shop[]> {
  const db = await getDb();
  const rows = await db.query(`SELECT * FROM shops WHERE is_active = TRUE ORDER BY id`);
  return rows.map(mapShop);
}

export async function getShop(shopId: number): Promise<Shop | null> {
  const db = await getDb();
  const rows = await db.query(`SELECT * FROM shops WHERE id = $1`, [shopId]);
  return rows[0] ? mapShop(rows[0]) : null;
}

export async function updateShop(shopId: number, patch: Record<string, unknown>): Promise<void> {
  const keys = Object.keys(patch);
  if (!keys.length) return;
  const db = await getDb();
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  await db.query(`UPDATE shops SET ${sets} WHERE id = $1`, [shopId, ...keys.map((k) => patch[k])]);
}

/* ---------------------------------------------------------------- catalog */

export async function listCategories(shopId: number): Promise<Category[]> {
  const db = await getDb();
  const rows = await db.query(
    `SELECT c.id, c.name
       FROM categories c
      WHERE c.shop_id = $1 AND c.is_active = TRUE
        AND EXISTS (SELECT 1 FROM products p
                     WHERE p.category_id = c.id AND p.shop_id = $1 AND p.is_available = TRUE)
      ORDER BY c.sort_order, c.id`,
    [shopId],
  );
  return rows.map((r) => ({ id: num(r.id), name: r.name }));
}

function mapProduct(r: any): Product {
  return {
    id: num(r.id),
    categoryId: num(r.category_id),
    name: r.name,
    description: r.description,
    photoFileId: r.photo_file_id,
    photoPath: r.photo_path ?? null,
    pricePerKg: num(r.price_per_kg),
    minKg: num(r.min_kg),
    maxKg: num(r.max_kg),
    weightOptions: (r.weight_options ?? []).map(num),
    isAvailable: r.is_available,
  };
}

export async function listProducts(
  shopId: number,
  categoryId: number,
  onlyAvailable = true,
): Promise<Product[]> {
  const db = await getDb();
  const rows = await db.query(
    `SELECT * FROM products
      WHERE shop_id = $1 AND category_id = $2 ${onlyAvailable ? 'AND is_available = TRUE' : ''}
      ORDER BY sort_order, id`,
    [shopId, categoryId],
  );
  return rows.map(mapProduct);
}

export async function listAllProducts(shopId: number): Promise<Product[]> {
  const db = await getDb();
  const rows = await db.query(
    `SELECT * FROM products WHERE shop_id = $1 ORDER BY category_id, sort_order, id`,
    [shopId],
  );
  return rows.map(mapProduct);
}

export async function getProduct(shopId: number, productId: number): Promise<Product | null> {
  const db = await getDb();
  const rows = await db.query(`SELECT * FROM products WHERE shop_id = $1 AND id = $2`, [
    shopId,
    productId,
  ]);
  return rows[0] ? mapProduct(rows[0]) : null;
}

export async function updateProduct(
  shopId: number,
  productId: number,
  patch: Record<string, unknown>,
): Promise<void> {
  const keys = Object.keys(patch);
  if (!keys.length) return;
  const db = await getDb();
  const sets = keys.map((k, i) => `${k} = $${i + 3}`).join(', ');
  await db.query(`UPDATE products SET ${sets} WHERE shop_id = $1 AND id = $2`, [
    shopId,
    productId,
    ...keys.map((k) => patch[k]),
  ]);
}

export async function listProductOptions(
  shopId: number,
  productId: number,
): Promise<ProductOption[]> {
  const db = await getDb();
  const rows = await db.query(
    `SELECT * FROM product_options WHERE shop_id = $1 AND product_id = $2
      ORDER BY sort_order, id`,
    [shopId, productId],
  );
  return rows.map((r) => ({
    id: num(r.id),
    productId: num(r.product_id),
    groupName: r.group_name,
    optionName: r.option_name,
    extraPrice: num(r.extra_price),
    priceType: r.price_type === 'per_kg' ? 'per_kg' : 'fixed',
  }));
}

/* -------------------------------------------------------------- customers */

function mapCustomer(r: any): Customer {
  return {
    id: num(r.id),
    telegramUserId: num(r.telegram_user_id),
    phone: r.phone,
    firstName: r.first_name,
    username: r.username,
    notificationsEnabled: r.notifications_enabled,
  };
}

export async function upsertCustomer(
  shopId: number,
  tgId: number,
  firstName?: string,
  username?: string,
): Promise<Customer> {
  const db = await getDb();
  const rows = await db.query(
    `INSERT INTO customers (shop_id, telegram_user_id, first_name, username)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (shop_id, telegram_user_id)
     DO UPDATE SET first_name = COALESCE(EXCLUDED.first_name, customers.first_name),
                   username   = COALESCE(EXCLUDED.username, customers.username)
     RETURNING *`,
    [shopId, tgId, firstName ?? null, username ?? null],
  );
  return mapCustomer(rows[0]);
}

export async function setCustomerPhone(
  shopId: number,
  tgId: number,
  phone: string,
): Promise<void> {
  const db = await getDb();
  await db.query(
    `UPDATE customers SET phone = $3 WHERE shop_id = $1 AND telegram_user_id = $2`,
    [shopId, tgId, phone],
  );
}

export async function setNotifications(
  shopId: number,
  tgId: number,
  enabled: boolean,
): Promise<void> {
  const db = await getDb();
  await db.query(
    `UPDATE customers SET notifications_enabled = $3 WHERE shop_id = $1 AND telegram_user_id = $2`,
    [shopId, tgId, enabled],
  );
}

/* --------------------------------------------------------------- sessions */

export async function getSession(shopId: number, tgId: number): Promise<Session> {
  const db = await getDb();
  const rows = await db.query(
    `SELECT state, draft FROM sessions WHERE shop_id = $1 AND telegram_user_id = $2`,
    [shopId, tgId],
  );
  if (!rows[0]) return { state: 'IDLE', draft: {} };
  const draft = typeof rows[0].draft === 'string' ? JSON.parse(rows[0].draft) : rows[0].draft;
  return { state: rows[0].state as CustomerState, draft: (draft ?? {}) as Draft };
}

export async function saveSession(
  shopId: number,
  tgId: number,
  state: CustomerState,
  draft: Draft,
): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO sessions (shop_id, telegram_user_id, state, draft, updated_at, expires_at)
     VALUES ($1, $2, $3, $4::jsonb, NOW(), NOW() + INTERVAL '2 hours')
     ON CONFLICT (shop_id, telegram_user_id)
     DO UPDATE SET state = EXCLUDED.state, draft = EXCLUDED.draft,
                   updated_at = NOW(), expires_at = NOW() + INTERVAL '2 hours'`,
    [shopId, tgId, state, JSON.stringify(draft)],
  );
}

export async function clearSession(shopId: number, tgId: number): Promise<void> {
  const db = await getDb();
  await db.query(`DELETE FROM sessions WHERE shop_id = $1 AND telegram_user_id = $2`, [
    shopId,
    tgId,
  ]);
}

export async function deleteExpiredSessions(): Promise<number> {
  const db = await getDb();
  const rows = await db.query(
    `DELETE FROM sessions WHERE expires_at < NOW() RETURNING shop_id`,
  );
  return rows.length;
}

/* ------------------------------------------------------------ slot holds */

export async function createHold(
  shopId: number,
  tgId: number,
  date: string,
  weightKg: number,
  minutes = 15,
): Promise<number> {
  const db = await getDb();
  await db.query(`DELETE FROM slot_holds WHERE shop_id = $1 AND telegram_user_id = $2`, [
    shopId,
    tgId,
  ]);
  const rows = await db.query(
    `INSERT INTO slot_holds (shop_id, telegram_user_id, hold_date, weight_kg, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + ($5 || ' minutes')::interval) RETURNING id`,
    [shopId, tgId, date, weightKg, String(minutes)],
  );
  return num(rows[0].id);
}

export async function releaseHold(shopId: number, tgId: number): Promise<void> {
  const db = await getDb();
  await db.query(`DELETE FROM slot_holds WHERE shop_id = $1 AND telegram_user_id = $2`, [
    shopId,
    tgId,
  ]);
}

export async function cleanupExpiredHolds(): Promise<number> {
  const db = await getDb();
  const rows = await db.query(`DELETE FROM slot_holds WHERE expires_at < NOW() RETURNING id`);
  return rows.length;
}

/* ------------------------------------------------------------- capacity */

export interface DayUsage {
  date: string;
  usedKg: number;
  usedOrders: number;
  capacityKg: number | null;
  capacityOrders: number | null;
  isBlocked: boolean;
}

/**
 * Berilgan sana oralig'i uchun band qilingan kg/buyurtmalar (aktiv hold'lar bilan birga)
 * va sana-specific capacity override'lar.
 */
export async function getUsage(
  shopId: number,
  from: string,
  to: string,
  excludeTgId?: number,
): Promise<Map<string, DayUsage>> {
  const db = await getDb();
  const orders = await db.query(
    `SELECT to_char(pickup_date, 'YYYY-MM-DD') AS d,
            COALESCE(SUM(weight_kg), 0) AS kg,
            COUNT(*) AS cnt
       FROM orders
      WHERE shop_id = $1 AND pickup_date BETWEEN $2::date AND $3::date
        AND status NOT IN ('CANCELLED', 'DRAFT')
      GROUP BY 1`,
    [shopId, from, to],
  );
  const holds = await db.query(
    `SELECT to_char(hold_date, 'YYYY-MM-DD') AS d,
            COALESCE(SUM(weight_kg), 0) AS kg,
            COUNT(*) AS cnt
       FROM slot_holds
      WHERE shop_id = $1 AND hold_date BETWEEN $2::date AND $3::date
        AND expires_at > NOW()
        AND ($4::bigint IS NULL OR telegram_user_id <> $4::bigint)
      GROUP BY 1`,
    [shopId, from, to, excludeTgId ?? null],
  );
  const overrides = await db.query(
    `SELECT to_char(override_date, 'YYYY-MM-DD') AS d, capacity_kg, capacity_orders, is_blocked
       FROM capacity_overrides
      WHERE shop_id = $1 AND override_date BETWEEN $2::date AND $3::date`,
    [shopId, from, to],
  );

  const map = new Map<string, DayUsage>();
  const ensure = (d: string): DayUsage => {
    let u = map.get(d);
    if (!u) {
      u = { date: d, usedKg: 0, usedOrders: 0, capacityKg: null, capacityOrders: null, isBlocked: false };
      map.set(d, u);
    }
    return u;
  };
  for (const r of orders) {
    const u = ensure(r.d);
    u.usedKg += num(r.kg);
    u.usedOrders += num(r.cnt);
  }
  for (const r of holds) {
    const u = ensure(r.d);
    u.usedKg += num(r.kg);
    u.usedOrders += num(r.cnt);
  }
  for (const r of overrides) {
    const u = ensure(r.d);
    u.capacityKg = r.capacity_kg === null ? null : num(r.capacity_kg);
    u.capacityOrders = r.capacity_orders === null ? null : num(r.capacity_orders);
    u.isBlocked = r.is_blocked;
  }
  return map;
}

export async function blockDate(shopId: number, date: string, note?: string): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO capacity_overrides (shop_id, override_date, is_blocked, note)
     VALUES ($1, $2, TRUE, $3)
     ON CONFLICT (shop_id, override_date)
     DO UPDATE SET is_blocked = TRUE, note = EXCLUDED.note`,
    [shopId, date, note ?? null],
  );
}

export async function unblockDate(shopId: number, date: string): Promise<void> {
  const db = await getDb();
  await db.query(
    `UPDATE capacity_overrides SET is_blocked = FALSE WHERE shop_id = $1 AND override_date = $2`,
    [shopId, date],
  );
}

/* ----------------------------------------------------------------- orders */

function mapOrder(r: any): Order {
  const parse = (v: unknown, fallback: unknown) =>
    v === null || v === undefined ? fallback : typeof v === 'string' ? JSON.parse(v) : v;
  return {
    id: num(r.id),
    shopId: num(r.shop_id),
    customerId: num(r.customer_id),
    orderNumber: num(r.order_number),
    status: r.status as OrderStatus,
    productSnapshot: parse(r.product_snapshot, {}) as Order['productSnapshot'],
    optionsSnapshot: parse(r.options_snapshot, []) as Order['optionsSnapshot'],
    weightKg: num(r.weight_kg),
    inscriptionText: r.inscription_text,
    deliveryType: r.delivery_type === 'delivery' ? 'delivery' : 'pickup',
    addressText: r.address_text,
    addressNote: r.address_note,
    lat: r.location_lat === null ? null : num(r.location_lat),
    lng: r.location_lng === null ? null : num(r.location_lng),
    pickupDate: r.pickup_date_str ?? r.pickup_date,
    pickupTimeSlot: r.pickup_time_slot,
    subtotal: num(r.subtotal),
    deliveryFee: num(r.delivery_fee),
    total: num(r.total),
    prepaidAmount: num(r.prepaid_amount),
    remainingAmount: num(r.remaining_amount),
    paymentStatus: r.payment_status,
    adminMessageId: r.admin_message_id === null ? null : num(r.admin_message_id),
    customerName: r.customer_name ?? null,
    customerPhone: r.customer_phone ?? null,
    customerTelegramId: r.customer_tg_id === undefined ? undefined : num(r.customer_tg_id),
  };
}

const ORDER_SELECT = `
  SELECT o.*, to_char(o.pickup_date, 'YYYY-MM-DD') AS pickup_date_str,
         c.first_name AS customer_name, c.phone AS customer_phone,
         c.telegram_user_id AS customer_tg_id
    FROM orders o
    JOIN customers c ON c.id = o.customer_id`;

export interface NewOrderInput {
  shopId: number;
  customerId: number;
  telegramUserId: number;
  productSnapshot: Order['productSnapshot'];
  optionsSnapshot: Order['optionsSnapshot'];
  weightKg: number;
  inscriptionText: string | null;
  deliveryType: 'delivery' | 'pickup';
  addressText: string | null;
  addressNote: string | null;
  lat: number | null;
  lng: number | null;
  pickupDate: string;
  pickupTimeSlot: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  prepaidAmount: number;
  remainingAmount: number;
  /** oxirgi tekshiruv: shu sanada joy bormi (tranzaksiya ichida) */
  capacityKg: number;
  capacityOrders: number;
}

export class SlotTakenError extends Error {
  constructor() {
    super('SLOT_TAKEN');
  }
}

/**
 * Buyurtmani yaratadi. Do'kon qatorini FOR UPDATE bilan bloklaydi, shuning uchun
 * ikki mijoz bir vaqtda oxirgi slotni ololmaydi.
 */
export async function createOrder(input: NewOrderInput): Promise<Order> {
  const db = await getDb();
  return db.transaction(async (tx: Conn) => {
    await tx.query(`SELECT id FROM shops WHERE id = $1 FOR UPDATE`, [input.shopId]);

    const usage = await tx.query(
      `SELECT COALESCE(SUM(weight_kg), 0) AS kg, COUNT(*) AS cnt
         FROM orders
        WHERE shop_id = $1 AND pickup_date = $2::date AND status NOT IN ('CANCELLED', 'DRAFT')`,
      [input.shopId, input.pickupDate],
    );
    const holds = await tx.query(
      `SELECT COALESCE(SUM(weight_kg), 0) AS kg, COUNT(*) AS cnt
         FROM slot_holds
        WHERE shop_id = $1 AND hold_date = $2::date AND expires_at > NOW()
          AND telegram_user_id <> $3`,
      [input.shopId, input.pickupDate, input.telegramUserId],
    );
    const usedKg = num(usage[0]?.kg) + num(holds[0]?.kg);
    const usedOrders = num(usage[0]?.cnt) + num(holds[0]?.cnt);
    if (usedKg + input.weightKg > input.capacityKg || usedOrders + 1 > input.capacityOrders) {
      throw new SlotTakenError();
    }

    const numRow = await tx.query(
      `SELECT COALESCE(MAX(order_number), 0) + 1 AS n FROM orders WHERE shop_id = $1`,
      [input.shopId],
    );
    const orderNumber = num(numRow[0].n);

    const rows = await tx.query(
      `INSERT INTO orders (
         shop_id, customer_id, order_number, status, product_snapshot, options_snapshot,
         weight_kg, inscription_text, delivery_type, address_text, location_lat, location_lng,
         address_note, pickup_date, pickup_time_slot, subtotal, delivery_fee, total,
         prepaid_amount, remaining_amount, payment_status)
       VALUES ($1,$2,$3,'AWAITING_PAYMENT',$4::jsonb,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13::date,
               $14,$15,$16,$17,$18,$19,'unpaid')
       RETURNING *, to_char(pickup_date, 'YYYY-MM-DD') AS pickup_date_str`,
      [
        input.shopId,
        input.customerId,
        orderNumber,
        JSON.stringify(input.productSnapshot),
        JSON.stringify(input.optionsSnapshot),
        input.weightKg,
        input.inscriptionText,
        input.deliveryType,
        input.addressText,
        input.lat,
        input.lng,
        input.addressNote,
        input.pickupDate,
        input.pickupTimeSlot,
        input.subtotal,
        input.deliveryFee,
        input.total,
        input.prepaidAmount,
        input.remainingAmount,
      ],
    );

    await tx.query(
      `INSERT INTO order_events (order_id, from_status, to_status, actor_type, actor_id)
       VALUES ($1, NULL, 'AWAITING_PAYMENT', 'customer', $2)`,
      [num(rows[0].id), input.telegramUserId],
    );
    await tx.query(`DELETE FROM slot_holds WHERE shop_id = $1 AND telegram_user_id = $2`, [
      input.shopId,
      input.telegramUserId,
    ]);

    return num(rows[0].id);
  }).then(async (orderId) => {
    // Mijoz ma'lumotlari bilan birga qaytaramiz — admin kartasi uchun kerak.
    const full = await getOrder(input.shopId, orderId);
    if (!full) throw new Error('Buyurtma yaratildi, lekin o\'qib bo\'lmadi');
    return full;
  });
}

export async function getOrder(shopId: number, orderId: number): Promise<Order | null> {
  const db = await getDb();
  const rows = await db.query(`${ORDER_SELECT} WHERE o.shop_id = $1 AND o.id = $2`, [
    shopId,
    orderId,
  ]);
  return rows[0] ? mapOrder(rows[0]) : null;
}

export async function listOrdersByDate(shopId: number, date: string): Promise<Order[]> {
  const db = await getDb();
  const rows = await db.query(
    `${ORDER_SELECT} WHERE o.shop_id = $1 AND o.pickup_date = $2::date
       AND o.status NOT IN ('CANCELLED', 'DRAFT')
     ORDER BY o.pickup_time_slot, o.order_number`,
    [shopId, date],
  );
  return rows.map(mapOrder);
}

export async function listCustomerOrders(shopId: number, tgId: number): Promise<Order[]> {
  const db = await getDb();
  const rows = await db.query(
    `${ORDER_SELECT} WHERE o.shop_id = $1 AND c.telegram_user_id = $2
     ORDER BY o.created_at DESC LIMIT 10`,
    [shopId, tgId],
  );
  return rows.map(mapOrder);
}

export async function countOrdersOnDate(shopId: number, date: string): Promise<number> {
  const db = await getDb();
  const rows = await db.query(
    `SELECT COUNT(*) AS c FROM orders
      WHERE shop_id = $1 AND pickup_date = $2::date AND status NOT IN ('CANCELLED','DRAFT')`,
    [shopId, date],
  );
  return num(rows[0].c);
}

export async function setOrderStatus(
  shopId: number,
  orderId: number,
  status: OrderStatus,
  actorType: 'admin' | 'customer' | 'system',
  actorId: number | null,
  reason?: string,
): Promise<Order | null> {
  const db = await getDb();
  const before = await getOrder(shopId, orderId);
  if (!before) return null;
  await db.query(
    `UPDATE orders SET status = $3,
            confirmed_at = CASE WHEN $3 = 'ACCEPTED' THEN NOW() ELSE confirmed_at END,
            completed_at = CASE WHEN $3 = 'COMPLETED' THEN NOW() ELSE completed_at END,
            cancelled_reason = COALESCE($4, cancelled_reason)
      WHERE shop_id = $1 AND id = $2`,
    [shopId, orderId, status, reason ?? null],
  );
  await db.query(
    `INSERT INTO order_events (order_id, from_status, to_status, actor_type, actor_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [orderId, before.status, status, actorType, actorId],
  );
  return getOrder(shopId, orderId);
}

export async function setPaymentStatus(
  shopId: number,
  orderId: number,
  paymentStatus: Order['paymentStatus'],
  receiptFileId?: string,
): Promise<void> {
  const db = await getDb();
  await db.query(
    `UPDATE orders SET payment_status = $3,
            payment_receipt_id = COALESCE($4, payment_receipt_id)
      WHERE shop_id = $1 AND id = $2`,
    [shopId, orderId, paymentStatus, receiptFileId ?? null],
  );
}

export async function setAdminMessageId(
  shopId: number,
  orderId: number,
  messageId: number,
): Promise<void> {
  const db = await getDb();
  await db.query(`UPDATE orders SET admin_message_id = $3 WHERE shop_id = $1 AND id = $2`, [
    shopId,
    orderId,
    messageId,
  ]);
}

export async function getReport(
  shopId: number,
  days: number,
): Promise<{ orders: number; kg: number; som: number }> {
  const db = await getDb();
  const rows = await db.query(
    `SELECT COUNT(*) AS cnt, COALESCE(SUM(weight_kg),0) AS kg, COALESCE(SUM(total),0) AS som
       FROM orders
      WHERE shop_id = $1 AND status NOT IN ('CANCELLED','DRAFT')
        AND created_at >= NOW() - ($2 || ' days')::interval`,
    [shopId, String(days)],
  );
  return { orders: num(rows[0].cnt), kg: num(rows[0].kg), som: num(rows[0].som) };
}

/** Ertaga buyurtmasi bor mijozlar (eslatma job uchun). */
export async function listOrdersForReminder(shopId: number, date: string): Promise<Order[]> {
  const db = await getDb();
  const rows = await db.query(
    `${ORDER_SELECT} WHERE o.shop_id = $1 AND o.pickup_date = $2::date
       AND o.status IN ('CONFIRMED','ACCEPTED','BAKING','READY')
       AND c.notifications_enabled = TRUE`,
    [shopId, date],
  );
  return rows.map(mapOrder);
}

/* -------------------------------------------------------------- occasions */

export async function addOccasion(
  shopId: number,
  customerId: number,
  name: string,
  date: string,
): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO occasions (shop_id, customer_id, occasion_name, occasion_date)
     VALUES ($1, $2, $3, $4::date)`,
    [shopId, customerId, name, date],
  );
}
