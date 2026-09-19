import { log } from '../config.js';
import { bots } from '../bot/context.js';
import {
  SlotTakenError,
  addOccasion,
  createHold,
  createOrder,
  getShop,
  listAllProductOptions,
  listAllProducts,
  listCategories,
  listCustomerOrders,
  releaseHold,
  saveSession,
  setCustomerPhone,
  upsertCustomer,
} from '../db/repo.js';
import { getAvailableDates } from '../services/availability.js';
import { formatDateLongUz, formatDateUz, monthUz, weekdayNameUz, weekdayUz } from '../services/dates.js';
import { notifyAdminNewOrder } from '../services/notify.js';
import { calcPrice, type PriceBreakdown } from '../services/pricing.js';
import { statusUz, t } from '../texts/uz.js';
import { w } from '../texts/webapp-uz.js';
import type { Order, Product, ProductOption, Shop } from '../types.js';

/** Foydalanuvchi xatosi — javobda 400 va shu matn qaytadi. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code?: string,
  ) {
    super(message);
  }
}

export interface ApiUser {
  id: number;
  firstName: string | null;
  username: string | null;
}

/* ---------------------------------------------------------------- bootstrap */

function productJson(p: Product, options: ProductOption[]) {
  return {
    id: p.id,
    categoryId: p.categoryId,
    name: p.name,
    description: p.description,
    pricePerKg: p.pricePerKg,
    minKg: p.minKg,
    maxKg: p.maxKg,
    weightOptions: p.weightOptions.filter((kg) => kg >= p.minKg && kg <= p.maxKg),
    photoUrl: p.photoPath || p.photoFileId ? `/api/photo/${p.id}` : null,
    options: options.map((o) => ({
      id: o.id,
      groupName: o.groupName,
      optionName: o.optionName,
      extraPrice: o.extraPrice,
      priceType: o.priceType,
    })),
  };
}

export async function bootstrap(shopId: number, user: ApiUser) {
  const shop = await mustShop(shopId);
  const customer = await upsertCustomer(shopId, user.id, user.firstName ?? undefined, user.username ?? undefined);
  const [categories, products, allOptions] = await Promise.all([
    listCategories(shopId),
    listAllProducts(shopId),
    listAllProductOptions(shopId),
  ]);

  const byProduct = new Map<number, ProductOption[]>();
  for (const o of allOptions) {
    const list = byProduct.get(o.productId);
    if (list) list.push(o);
    else byProduct.set(o.productId, [o]);
  }

  return {
    texts: w,
    shop: {
      name: shop.name,
      contactPhone: shop.contactPhone,
      prepaymentPercent: shop.prepaymentPercent,
      deliveryFee: shop.deliveryFee,
      inscriptionPrice: shop.inscriptionPrice,
      leadTimeHours: shop.leadTimeHours,
      timeSlots: shop.timeSlots,
      workingDays: shop.workingDays.map(weekdayNameUz),
    },
    customer: { phone: customer.phone, firstName: customer.firstName },
    categories,
    products: products
      .filter((p) => p.isAvailable)
      .map((p) => productJson(p, byProduct.get(p.id) ?? [])),
  };
}

/* -------------------------------------------------------------------- dates */

export async function availableDates(shopId: number, user: ApiUser, weightKg: number) {
  const shop = await mustShop(shopId);
  if (!Number.isFinite(weightKg) || weightKg <= 0) throw new ApiError(w.errorGeneric);
  const days = await getAvailableDates(shop, weightKg, user.id);
  return {
    days: days.slice(0, 30).map((d) => ({
      date: d.date,
      day: Number(d.date.split('-')[2]),
      month: monthUz(d.date),
      weekday: weekdayUz(d.date),
      label: formatDateUz(d.date),
      labelLong: formatDateLongUz(d.date),
      slotsForRequest: d.slotsForRequest,
    })),
  };
}

/* -------------------------------------------------------------------- quote */

export interface DraftInput {
  productId?: unknown;
  weightKg?: unknown;
  optionIds?: unknown;
  inscription?: unknown;
  date?: unknown;
  timeSlot?: unknown;
  deliveryType?: unknown;
  addressText?: unknown;
  addressNote?: unknown;
  phone?: unknown;
}

interface ResolvedDraft {
  product: Product;
  options: ProductOption[];
  weightKg: number;
  inscription: string | null;
  deliveryType: 'delivery' | 'pickup';
  price: PriceBreakdown;
}

/**
 * Mini App ochiq internetdan kelgan ma'lumot yuboradi — har bir maydon shu yerda
 * qaytadan tekshiriladi va narx server tomonida hisoblanadi. Brauzerdagi hisob
 * faqat ko'rsatish uchun (public/price.js).
 */
async function resolveDraft(shop: Shop, input: DraftInput): Promise<ResolvedDraft> {
  const products = await listAllProducts(shop.id);
  const product = products.find((p) => p.id === Number(input.productId) && p.isAvailable);
  if (!product) throw new ApiError(w.errorGeneric);

  const weightKg = Math.round(Number(input.weightKg) * 100) / 100;
  if (!Number.isFinite(weightKg) || weightKg < product.minKg || weightKg > product.maxKg) {
    throw new ApiError(w.errorGeneric);
  }

  const wantedIds = Array.isArray(input.optionIds) ? input.optionIds.map(Number) : [];
  const all = (await listAllProductOptions(shop.id)).filter((o) => o.productId === product.id);
  // Har guruhdan bittadan: takror kelsa oxirgisi olinadi.
  const perGroup = new Map<string, ProductOption>();
  for (const id of wantedIds) {
    const opt = all.find((o) => o.id === id);
    if (opt) perGroup.set(opt.groupName, opt);
  }
  const options = all.filter((o) => perGroup.get(o.groupName)?.id === o.id);

  const rawInscription = typeof input.inscription === 'string' ? input.inscription.trim() : '';
  if (rawInscription.length > 40) throw new ApiError(w.inscriptionTooLong);
  const inscription = rawInscription || null;

  const deliveryType = input.deliveryType === 'delivery' ? 'delivery' : 'pickup';

  const price = calcPrice({
    pricePerKg: product.pricePerKg,
    weightKg,
    options: options.map((o) => ({
      groupName: o.groupName,
      optionName: o.optionName,
      extraPrice: o.extraPrice,
      priceType: o.priceType,
    })),
    hasInscription: Boolean(inscription),
    inscriptionPrice: shop.inscriptionPrice,
    deliveryFee: deliveryType === 'delivery' ? shop.deliveryFee : 0,
    prepaymentPercent: shop.prepaymentPercent,
  });

  return { product, options, weightKg, inscription, deliveryType, price };
}

function priceJson(d: ResolvedDraft) {
  return {
    base: d.price.base,
    optionLines: d.price.optionLines,
    inscription: d.price.inscription,
    delivery: d.price.delivery,
    subtotal: d.price.subtotal,
    total: d.price.total,
    prepaid: d.price.prepaid,
    remaining: d.price.remaining,
  };
}

/**
 * Hisob ekrani ochilganda chaqiriladi: narxni server hisoblaydi va sanani 15 daqiqaga
 * vaqtincha band qiladi (PRD 5.2), xuddi bot oqimidagidek.
 */
export async function quote(shopId: number, user: ApiUser, input: DraftInput) {
  const shop = await mustShop(shopId);
  const draft = await resolveDraft(shop, input);
  const date = typeof input.date === 'string' ? input.date : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    await createHold(shop.id, user.id, date, draft.weightKg, 15);
  }
  return { price: priceJson(draft) };
}

export async function cancelHold(shopId: number, user: ApiUser) {
  await releaseHold(shopId, user.id);
  return { ok: true };
}

/* -------------------------------------------------------------------- phone */

const PHONE_RE = /^\+?998\d{9}$/;

function normalizePhone(raw: unknown): string {
  const phone = String(raw ?? '').replace(/[\s()-]/g, '');
  if (!PHONE_RE.test(phone)) throw new ApiError(w.phoneInvalid);
  return phone.startsWith('+') ? phone : `+${phone}`;
}

export async function savePhone(shopId: number, user: ApiUser, input: { phone?: unknown }) {
  const phone = normalizePhone(input.phone);
  await upsertCustomer(shopId, user.id, user.firstName ?? undefined, user.username ?? undefined);
  await setCustomerPhone(shopId, user.id, phone);
  return { phone };
}

/* ------------------------------------------------------------------- order */

export async function submitOrder(shopId: number, user: ApiUser, input: DraftInput) {
  const shop = await mustShop(shopId);
  const draft = await resolveDraft(shop, input);

  const date = typeof input.date === 'string' ? input.date : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ApiError(w.errorGeneric);

  const timeSlot = typeof input.timeSlot === 'string' ? input.timeSlot : '';
  if (!shop.timeSlots.includes(timeSlot)) throw new ApiError(w.errorGeneric);

  const addressText =
    typeof input.addressText === 'string' ? input.addressText.trim().slice(0, 300) : '';
  if (draft.deliveryType === 'delivery' && !addressText) throw new ApiError(w.addressRequired);
  const addressNote =
    typeof input.addressNote === 'string' ? input.addressNote.trim().slice(0, 300) : '';

  const customer = await upsertCustomer(
    shopId,
    user.id,
    user.firstName ?? undefined,
    user.username ?? undefined,
  );
  const phone = input.phone ? normalizePhone(input.phone) : customer.phone;
  if (!phone) throw new ApiError(w.phoneInvalid);
  if (phone !== customer.phone) await setCustomerPhone(shopId, user.id, phone);

  try {
    const order = await createOrder({
      shopId,
      customerId: customer.id,
      telegramUserId: user.id,
      productSnapshot: { name: draft.product.name, pricePerKg: draft.product.pricePerKg },
      optionsSnapshot: draft.options.map((o, i) => ({
        groupName: o.groupName,
        optionName: o.optionName,
        price: draft.price.optionLines[i]?.amount ?? 0,
      })),
      weightKg: draft.weightKg,
      inscriptionText: draft.inscription,
      deliveryType: draft.deliveryType,
      addressText: draft.deliveryType === 'delivery' ? addressText : null,
      addressNote: addressNote || null,
      lat: null,
      lng: null,
      pickupDate: date,
      pickupTimeSlot: timeSlot,
      subtotal: draft.price.subtotal,
      deliveryFee: draft.price.delivery,
      total: draft.price.total,
      prepaidAmount: draft.price.prepaid,
      remainingAmount: draft.price.remaining,
      capacityKg: shop.dailyCapacityKg,
      capacityOrders: shop.dailyCapacityOrders,
    });

    // Tug'ilgan kun bazasi: yozuvdan ism olinadi (PRD 9.2) — bot oqimidagidek.
    if (draft.inscription) {
      const name = draft.inscription.split(/\s+/)[0];
      if (name && name.length > 1) await addOccasion(shopId, customer.id, name, date);
    }

    // Chek rasmi botga tushganda handler shu holatdan orderId ni topadi.
    await saveSession(shopId, user.id, 'PAYMENT', { orderId: order.id, history: [] });
    await sendPaymentMessage(shop, user.id, order);
    await notifyAdminNewOrder(order);

    return {
      orderNumber: order.orderNumber,
      total: order.total,
      prepaid: order.prepaidAmount,
      remaining: order.remainingAmount,
      card: shop.paymentCard,
      cardHolder: shop.paymentCardHolder,
      dateLabel: formatDateLongUz(order.pickupDate),
      timeSlot: order.pickupTimeSlot,
    };
  } catch (e) {
    if (e instanceof SlotTakenError) {
      await releaseHold(shopId, user.id);
      throw new ApiError(w.slotTaken, 409, 'SLOT_TAKEN');
    }
    throw e;
  }
}

/** To'lov ko'rsatmasi chatga ham boradi — karta raqami mini app yopilgach ham qoladi. */
async function sendPaymentMessage(shop: Shop, tgId: number, order: Order): Promise<void> {
  const bot = bots.get(shop.id);
  if (!bot) return;
  try {
    await bot.api.sendMessage(
      tgId,
      t.paymentInstructions({
        orderNumber: order.orderNumber,
        prepaid: order.prepaidAmount,
        card: shop.paymentCard,
        cardHolder: shop.paymentCardHolder,
      }),
      { parse_mode: 'Markdown' },
    );
  } catch (e) {
    log.warn('To\'lov ko\'rsatmasi yuborilmadi', e instanceof Error ? e.message : e);
  }
}

/* ------------------------------------------------------------------ orders */

export async function myOrders(shopId: number, user: ApiUser) {
  const orders = await listCustomerOrders(shopId, user.id);
  return {
    orders: orders.map((o) => ({
      orderNumber: o.orderNumber,
      status: o.status,
      statusLabel: statusUz(o.status),
      productName: o.productSnapshot.name,
      weightKg: o.weightKg,
      dateLabel: formatDateLongUz(o.pickupDate),
      timeSlot: o.pickupTimeSlot,
      deliveryType: o.deliveryType,
      total: o.total,
      prepaid: o.prepaidAmount,
      remaining: o.remainingAmount,
      paymentStatus: o.paymentStatus,
    })),
  };
}

/* ------------------------------------------------------------------ helper */

async function mustShop(shopId: number): Promise<Shop> {
  const shop = await getShop(shopId);
  if (!shop) throw new ApiError(w.errorGeneric, 500);
  return shop;
}
