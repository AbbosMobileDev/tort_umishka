import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { InputFile, type Bot } from 'grammy';
import { log } from '../config.js';
import {
  SlotTakenError,
  addOccasion,
  clearSession,
  createHold,
  createOrder,
  getProduct,
  getSession,
  listCategories,
  listCustomerOrders,
  listProductOptions,
  listProducts,
  releaseHold,
  saveSession,
  updateProduct,
  setCustomerPhone,
  setPaymentStatus,
  upsertCustomer,
} from '../db/repo.js';
import { getAvailableDates } from '../services/availability.js';
import { notifyAdminNewOrder, notifyAdminReceipt } from '../services/notify.js';
import { calcPrice, formatKg, type PriceBreakdown } from '../services/pricing.js';
import { t } from '../texts/uz.js';
import type { CustomerState, Draft, Product, ProductOption, Shop } from '../types.js';
import type { BotContext } from './context.js';
import {
  addressNoteKeyboard,
  categoriesKeyboard,
  datesKeyboard,
  deliveryKeyboard,
  inscriptionKeyboard,
  locationKeyboard,
  mainMenuKeyboard,
  navKeyboard,
  openAppKeyboard,
  optionsKeyboard,
  phoneKeyboard,
  productSelectKeyboard,
  summaryKeyboard,
  timeKeyboard,
  weightKeyboard,
} from './keyboards.js';
import { miniAppUrl } from '../web/url.js';

const MD = { parse_mode: 'Markdown' } as const;

function uid(ctx: BotContext): number {
  return ctx.from!.id;
}

async function ans(ctx: BotContext): Promise<void> {
  try {
    await ctx.answerCallbackQuery();
  } catch {
    /* eskirgan callback — muhim emas */
  }
}

/** Eski xabardagi tugmalarni olib tashlaydi, foydalanuvchi eski tugmani bosmasin. */
async function stripButtons(ctx: BotContext): Promise<void> {
  try {
    await ctx.editMessageReplyMarkup();
  } catch {
    /* xabar o'zgarmagan bo'lishi mumkin */
  }
}

/* --------------------------------------------------------------- renderers */

async function showCatalog(ctx: BotContext): Promise<void> {
  const cats = await listCategories(ctx.shop.id);
  if (!cats.length) {
    await ctx.reply(t.emptyCatalog);
    return;
  }
  await ctx.reply(t.askCategory, { reply_markup: categoriesKeyboard(cats) });
}

/**
 * Mahsulot kartasi: rasm + tavsif + "tanlash" tugmasi.
 * Rasm birinchi marta diskdan yuklanadi, Telegram qaytargan file_id bazaga saqlanadi —
 * keyingi safar yuklash o'rniga o'sha ID ishlatiladi (tezroq va yengilroq).
 */
async function sendProductCard(ctx: BotContext, p: Product): Promise<boolean> {
  const caption = t.productCard(p.name, p.description, p.pricePerKg);
  const options = {
    caption,
    parse_mode: 'Markdown' as const,
    reply_markup: productSelectKeyboard(p),
  };

  if (p.photoFileId) {
    try {
      await ctx.replyWithPhoto(p.photoFileId, options);
      return true;
    } catch {
      // file_id eskirgan bo'lishi mumkin — quyida qaytadan yuklaymiz
      await updateProduct(ctx.shop.id, p.id, { photo_file_id: null });
    }
  }

  const path = p.photoPath ? resolve(process.cwd(), p.photoPath) : null;
  if (path && existsSync(path)) {
    try {
      const msg = await ctx.replyWithPhoto(new InputFile(path), options);
      const fileId = msg.photo?.at(-1)?.file_id;
      if (fileId) await updateProduct(ctx.shop.id, p.id, { photo_file_id: fileId });
      return true;
    } catch (e) {
      log.warn(`Rasm yuklanmadi: ${p.name}`, e instanceof Error ? e.message : e);
    }
  }

  await ctx.reply(caption, { ...MD, reply_markup: productSelectKeyboard(p) });
  return false;
}

async function showProducts(ctx: BotContext, draft: Draft): Promise<void> {
  const products = await listProducts(ctx.shop.id, draft.categoryId!);
  if (!products.length) {
    await ctx.reply(t.emptyCatalog);
    return;
  }
  for (const p of products) await sendProductCard(ctx, p);
  await ctx.reply(t.askProduct, { reply_markup: navKeyboard() });
}

async function showWeight(ctx: BotContext, draft: Draft): Promise<void> {
  const product = await getProduct(ctx.shop.id, draft.productId!);
  if (!product) return;
  await ctx.reply(t.askWeight(product.name), {
    ...MD,
    reply_markup: weightKeyboard(product),
  });
}

async function optionGroups(shopId: number, productId: number): Promise<string[]> {
  const opts = await listProductOptions(shopId, productId);
  return [...new Set(opts.map((o) => o.groupName))];
}

async function showOptions(ctx: BotContext, draft: Draft): Promise<void> {
  const all = await listProductOptions(ctx.shop.id, draft.productId!);
  const groups = [...new Set(all.map((o) => o.groupName))];
  const idx = draft.optionGroupIndex ?? 0;
  const group = groups[idx];
  const inGroup = all.filter((o) => o.groupName === group);
  await ctx.reply(t.askOption(group), {
    reply_markup: optionsKeyboard(inGroup, draft.weightKg ?? 1),
  });
}

async function showInscription(ctx: BotContext): Promise<void> {
  await ctx.reply(t.askInscription, { reply_markup: inscriptionKeyboard() });
}

async function showDate(ctx: BotContext, draft: Draft): Promise<void> {
  const days = await getAvailableDates(ctx.shop, draft.weightKg!, uid(ctx));
  if (!days.length) {
    await ctx.reply(t.noDates);
    return;
  }
  await ctx.reply(t.askDate(draft.weightKg!), { reply_markup: datesKeyboard(days) });
}

async function showTime(ctx: BotContext, draft: Draft): Promise<void> {
  await ctx.reply(t.askTime(draft.date!), { reply_markup: timeKeyboard(ctx.shop.timeSlots) });
}

async function showDelivery(ctx: BotContext): Promise<void> {
  await ctx.reply(t.askDelivery, { reply_markup: deliveryKeyboard(ctx.shop.deliveryFee) });
}

async function showAddress(ctx: BotContext): Promise<void> {
  await ctx.reply(t.askAddress, { reply_markup: locationKeyboard() });
}

async function showAddressNote(ctx: BotContext): Promise<void> {
  await ctx.reply(t.askAddressNote, { reply_markup: addressNoteKeyboard() });
}

/** Buyurtma qoralamasidan narx va tafsilotlarni yig'adi. */
async function buildPreview(
  shop: Shop,
  draft: Draft,
): Promise<{ product: Product; options: ProductOption[]; price: PriceBreakdown } | null> {
  const product = await getProduct(shop.id, draft.productId!);
  if (!product) return null;
  const all = await listProductOptions(shop.id, product.id);
  const chosenIds = Object.values(draft.options ?? {});
  const options = all.filter((o) => chosenIds.includes(o.id));
  const price = calcPrice({
    pricePerKg: product.pricePerKg,
    weightKg: draft.weightKg!,
    options: options.map((o) => ({
      groupName: o.groupName,
      optionName: o.optionName,
      extraPrice: o.extraPrice,
      priceType: o.priceType,
    })),
    hasInscription: Boolean(draft.inscription),
    inscriptionPrice: shop.inscriptionPrice,
    deliveryFee: draft.deliveryType === 'delivery' ? shop.deliveryFee : 0,
    prepaymentPercent: shop.prepaymentPercent,
  });
  return { product, options, price };
}

async function showSummary(ctx: BotContext, draft: Draft): Promise<void> {
  const preview = await buildPreview(ctx.shop, draft);
  if (!preview) return;
  // Slotni 15 daqiqaga vaqtincha rezerv qilamiz (PRD 5.2 edge-case).
  draft.holdId = await createHold(ctx.shop.id, uid(ctx), draft.date!, draft.weightKg!, 15);
  await saveSession(ctx.shop.id, uid(ctx), 'SUMMARY', draft);

  await ctx.reply(
    t.summary({
      productName: preview.product.name,
      weightKg: draft.weightKg!,
      optionLines: preview.price.optionLines,
      inscription: draft.inscription ?? null,
      date: draft.date!,
      timeSlot: draft.timeSlot!,
      deliveryType: draft.deliveryType!,
      address: draft.addressText ?? null,
      price: preview.price,
    }),
    { ...MD, reply_markup: summaryKeyboard() },
  );
}

const renderers: Partial<Record<CustomerState, (ctx: BotContext, draft: Draft) => Promise<void>>> = {
  CATALOG: (ctx) => showCatalog(ctx),
  PRODUCT: showProducts,
  WEIGHT: showWeight,
  OPTIONS: showOptions,
  INSCRIPTION: (ctx) => showInscription(ctx),
  DATE: showDate,
  TIME: showTime,
  DELIVERY: (ctx) => showDelivery(ctx),
  ADDRESS: (ctx) => showAddress(ctx),
  ADDRESS_NOTE: (ctx) => showAddressNote(ctx),
  SUMMARY: showSummary,
};

async function enter(
  ctx: BotContext,
  state: CustomerState,
  draft: Draft,
  fromState?: CustomerState,
): Promise<void> {
  if (fromState) draft.history = [...(draft.history ?? []), fromState];
  await saveSession(ctx.shop.id, uid(ctx), state, draft);
  const render = renderers[state];
  if (render) await render(ctx, draft);
}

/** Ichlik/bezak guruhlari tugagan bo'lsa — yozuv bosqichiga o'tadi. */
async function advanceOptions(
  ctx: BotContext,
  draft: Draft,
  fromState: CustomerState,
): Promise<void> {
  const groups = await optionGroups(ctx.shop.id, draft.productId!);
  const idx = draft.optionGroupIndex ?? 0;
  if (idx >= groups.length) {
    draft.optionGroupIndex = groups.length;
    await enter(ctx, 'INSCRIPTION', draft, fromState);
    return;
  }
  await enter(ctx, 'OPTIONS', draft, fromState);
}

/* ---------------------------------------------------------------- handlers */

export function registerCustomerHandlers(bot: Bot<BotContext>): void {
  bot.command('start', async (ctx) => {
    await upsertCustomer(ctx.shop.id, uid(ctx), ctx.from?.first_name, ctx.from?.username);
    await clearSession(ctx.shop.id, uid(ctx));
    const app = miniAppUrl();
    await ctx.reply(app ? t.welcomeApp(ctx.shop.name) : t.welcome(ctx.shop.name), {
      ...MD,
      reply_markup: mainMenuKeyboard(app),
    });
    // Doimiy menyu va ilovani ochadigan tugma bitta xabarga sig'maydi (Telegramda
    // bitta xabarda bitta reply_markup), shuning uchun ikkinchi qisqa xabar.
    if (app) await ctx.reply(t.catalogPrompt, { reply_markup: openAppKeyboard(app) });
  });

  /* --- asosiy menyu tugmalari (reply keyboard) */
  bot.hears(t.btnOrder, async (ctx) => {
    const customer = await upsertCustomer(
      ctx.shop.id,
      uid(ctx),
      ctx.from?.first_name,
      ctx.from?.username,
    );
    const draft: Draft = { history: [] };
    if (!customer.phone) {
      await saveSession(ctx.shop.id, uid(ctx), 'PHONE', draft);
      await ctx.reply(t.askPhone, { ...MD, reply_markup: phoneKeyboard() });
      return;
    }
    await enter(ctx, 'CATALOG', draft);
  });

  bot.hears(t.btnMyOrders, async (ctx) => {
    const orders = await listCustomerOrders(ctx.shop.id, uid(ctx));
    if (!orders.length) {
      await ctx.reply(t.noOrders);
      return;
    }
    await ctx.reply(
      `${t.myOrdersHeader}\n\n${orders.map((o) => t.orderLine(o)).join('\n\n')}`,
      MD,
    );
  });

  bot.hears(t.btnContact, async (ctx) => {
    await ctx.reply(t.contactInfo(ctx.shop.name, ctx.shop.contactPhone), MD);
  });

  /* --- telefon raqam */
  bot.on('message:contact', async (ctx) => {
    const phone = ctx.message.contact.phone_number.replace(/[^\d+]/g, '');
    await setCustomerPhone(ctx.shop.id, uid(ctx), phone.startsWith('+') ? phone : `+${phone}`);
    await ctx.reply(t.phoneSaved, { reply_markup: mainMenuKeyboard(miniAppUrl()) });
    await enter(ctx, 'CATALOG', { history: [] });
  });

  /* --- navigatsiya */
  bot.callbackQuery('nav:cancel', async (ctx) => {
    await ans(ctx);
    await stripButtons(ctx);
    await releaseHold(ctx.shop.id, uid(ctx));
    await clearSession(ctx.shop.id, uid(ctx));
    await ctx.reply(t.cancelled, { reply_markup: mainMenuKeyboard(miniAppUrl()) });
  });

  bot.callbackQuery('nav:back', async (ctx) => {
    await ans(ctx);
    await stripButtons(ctx);
    const { draft } = await getSession(ctx.shop.id, uid(ctx));
    const history = [...(draft.history ?? [])];
    const prev = history.pop() ?? 'CATALOG';
    draft.history = history;
    if (prev === 'OPTIONS') {
      draft.optionGroupIndex = Math.max(0, (draft.optionGroupIndex ?? 1) - 1);
    }
    if (prev === 'SUMMARY' || prev === 'PAYMENT') {
      await enter(ctx, 'CATALOG', { history: [] });
      return;
    }
    await releaseHold(ctx.shop.id, uid(ctx));
    await enter(ctx, prev, draft);
  });

  /* --- kategoriya */
  bot.callbackQuery(/^cat:(\d+)$/, async (ctx) => {
    await ans(ctx);
    await stripButtons(ctx);
    const { draft } = await getSession(ctx.shop.id, uid(ctx));
    draft.categoryId = Number(ctx.match![1]);
    await enter(ctx, 'PRODUCT', draft, 'CATALOG');
  });

  /* --- mahsulot */
  bot.callbackQuery(/^prod:(\d+)$/, async (ctx) => {
    await ans(ctx);
    await stripButtons(ctx);
    const { draft } = await getSession(ctx.shop.id, uid(ctx));
    draft.productId = Number(ctx.match![1]);
    draft.options = {};
    draft.optionGroupIndex = 0;
    await enter(ctx, 'WEIGHT', draft, 'PRODUCT');
  });

  /* --- og'irlik */
  bot.callbackQuery(/^wt:(.+)$/, async (ctx) => {
    await ans(ctx);
    await stripButtons(ctx);
    const { draft } = await getSession(ctx.shop.id, uid(ctx));
    const raw = ctx.match![1];
    if (raw === 'other') {
      const product = await getProduct(ctx.shop.id, draft.productId!);
      if (!product) return;
      await saveSession(ctx.shop.id, uid(ctx), 'WEIGHT_CUSTOM', draft);
      await ctx.reply(t.askWeightCustom(product.minKg, product.maxKg), MD);
      return;
    }
    draft.weightKg = Number(raw);
    draft.optionGroupIndex = 0;
    await advanceOptions(ctx, draft, 'WEIGHT');
  });

  /* --- ichlik / bezak */
  bot.callbackQuery(/^opt:(\d+)$/, async (ctx) => {
    await ans(ctx);
    await stripButtons(ctx);
    const { draft } = await getSession(ctx.shop.id, uid(ctx));
    const optionId = Number(ctx.match![1]);
    const all = await listProductOptions(ctx.shop.id, draft.productId!);
    const chosen = all.find((o) => o.id === optionId);
    if (!chosen) return;
    draft.options = { ...(draft.options ?? {}), [chosen.groupName]: optionId };
    draft.optionGroupIndex = (draft.optionGroupIndex ?? 0) + 1;
    await advanceOptions(ctx, draft, 'OPTIONS');
  });

  /* --- yozuv */
  bot.callbackQuery(/^ins:(y|n)$/, async (ctx) => {
    await ans(ctx);
    await stripButtons(ctx);
    const { draft } = await getSession(ctx.shop.id, uid(ctx));
    if (ctx.match![1] === 'n') {
      draft.inscription = null;
      await enter(ctx, 'DATE', draft, 'INSCRIPTION');
      return;
    }
    await saveSession(ctx.shop.id, uid(ctx), 'INSCRIPTION_TEXT', draft);
    await ctx.reply(t.askInscriptionText);
  });

  /* --- sana */
  bot.callbackQuery(/^date:(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
    await ans(ctx);
    await stripButtons(ctx);
    const { draft } = await getSession(ctx.shop.id, uid(ctx));
    draft.date = ctx.match![1];
    await enter(ctx, 'TIME', draft, 'DATE');
  });

  /* --- vaqt */
  bot.callbackQuery(/^time:(\d+)$/, async (ctx) => {
    await ans(ctx);
    await stripButtons(ctx);
    const { draft } = await getSession(ctx.shop.id, uid(ctx));
    draft.timeSlot = ctx.shop.timeSlots[Number(ctx.match![1])] ?? ctx.shop.timeSlots[0];
    await enter(ctx, 'DELIVERY', draft, 'TIME');
  });

  /* --- yetkazish */
  bot.callbackQuery(/^dlv:(d|p)$/, async (ctx) => {
    await ans(ctx);
    await stripButtons(ctx);
    const { draft } = await getSession(ctx.shop.id, uid(ctx));
    if (ctx.match![1] === 'p') {
      draft.deliveryType = 'pickup';
      draft.addressText = null as unknown as undefined;
      await enter(ctx, 'SUMMARY', draft, 'DELIVERY');
      return;
    }
    draft.deliveryType = 'delivery';
    await enter(ctx, 'ADDRESS', draft, 'DELIVERY');
  });

  bot.on('message:location', async (ctx) => {
    const { state, draft } = await getSession(ctx.shop.id, uid(ctx));
    if (state !== 'ADDRESS') return;
    draft.lat = ctx.message.location.latitude;
    draft.lng = ctx.message.location.longitude;
    draft.addressText = `📍 ${draft.lat.toFixed(5)}, ${draft.lng.toFixed(5)}`;
    await ctx.reply('✅', { reply_markup: mainMenuKeyboard(miniAppUrl()) });
    await enter(ctx, 'ADDRESS_NOTE', draft, 'ADDRESS');
  });

  bot.callbackQuery('addr:skip', async (ctx) => {
    await ans(ctx);
    await stripButtons(ctx);
    const { draft } = await getSession(ctx.shop.id, uid(ctx));
    draft.addressNote = undefined;
    await enter(ctx, 'SUMMARY', draft, 'ADDRESS_NOTE');
  });

  /* --- yakuniy tasdiq */
  bot.callbackQuery('sum:edit', async (ctx) => {
    await ans(ctx);
    await stripButtons(ctx);
    await releaseHold(ctx.shop.id, uid(ctx));
    await enter(ctx, 'CATALOG', { history: [] });
  });

  bot.callbackQuery('sum:ok', async (ctx) => {
    await ans(ctx);
    await stripButtons(ctx);
    const { draft } = await getSession(ctx.shop.id, uid(ctx));
    const preview = await buildPreview(ctx.shop, draft);
    if (!preview) {
      await ctx.reply(t.sessionExpired);
      return;
    }
    const customer = await upsertCustomer(ctx.shop.id, uid(ctx));

    try {
      const order = await createOrder({
        shopId: ctx.shop.id,
        customerId: customer.id,
        telegramUserId: uid(ctx),
        productSnapshot: {
          name: preview.product.name,
          pricePerKg: preview.product.pricePerKg,
        },
        optionsSnapshot: preview.options.map((o, i) => ({
          groupName: o.groupName,
          optionName: o.optionName,
          price: preview.price.optionLines[i]?.amount ?? 0,
        })),
        weightKg: draft.weightKg!,
        inscriptionText: draft.inscription ?? null,
        deliveryType: draft.deliveryType!,
        addressText: draft.addressText ?? null,
        addressNote: draft.addressNote ?? null,
        lat: draft.lat ?? null,
        lng: draft.lng ?? null,
        pickupDate: draft.date!,
        pickupTimeSlot: draft.timeSlot!,
        subtotal: preview.price.subtotal,
        deliveryFee: preview.price.delivery,
        total: preview.price.total,
        prepaidAmount: preview.price.prepaid,
        remainingAmount: preview.price.remaining,
        capacityKg: ctx.shop.dailyCapacityKg,
        capacityOrders: ctx.shop.dailyCapacityOrders,
      });

      // Tug'ilgan kun bazasi: yozuvdan ism olinadi (PRD 9.2).
      if (draft.inscription) {
        const name = draft.inscription.split(/\s+/)[0];
        if (name && name.length > 1) {
          await addOccasion(ctx.shop.id, customer.id, name, draft.date!);
        }
      }

      await saveSession(ctx.shop.id, uid(ctx), 'PAYMENT', { orderId: order.id, history: [] });
      await ctx.reply(
        t.paymentInstructions({
          orderNumber: order.orderNumber,
          prepaid: order.prepaidAmount,
          card: ctx.shop.paymentCard,
          cardHolder: ctx.shop.paymentCardHolder,
        }),
        MD,
      );
      await notifyAdminNewOrder(order);
    } catch (e) {
      if (e instanceof SlotTakenError) {
        await releaseHold(ctx.shop.id, uid(ctx));
        await ctx.reply(t.slotTaken);
        await enter(ctx, 'DATE', draft);
        return;
      }
      log.error('Buyurtma yaratishda xato', e);
      throw e;
    }
  });

  /* --- chek skrinshoti */
  bot.on('message:photo', async (ctx, next) => {
    const { state, draft } = await getSession(ctx.shop.id, uid(ctx));
    if (state !== 'PAYMENT' || !draft.orderId) return next();
    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    await setPaymentStatus(ctx.shop.id, draft.orderId, 'receipt_sent', fileId);
    const { getOrder } = await import('../db/repo.js');
    const order = await getOrder(ctx.shop.id, draft.orderId);
    if (order) await notifyAdminReceipt(order, fileId);
    await ctx.reply(t.receiptReceived, { reply_markup: mainMenuKeyboard(miniAppUrl()) });
    await clearSession(ctx.shop.id, uid(ctx));
  });

  /* --- matn kiritiladigan holatlar */
  bot.on('message:text', async (ctx, next) => {
    const text = ctx.message.text.trim();
    if (text.startsWith('/')) return next();
    const { state, draft } = await getSession(ctx.shop.id, uid(ctx));

    switch (state) {
      case 'PHONE': {
        const phone = text.replace(/[\s()-]/g, '');
        if (!/^\+?998\d{9}$/.test(phone)) {
          await ctx.reply(t.phoneInvalid);
          return;
        }
        await setCustomerPhone(ctx.shop.id, uid(ctx), phone.startsWith('+') ? phone : `+${phone}`);
        await ctx.reply(t.phoneSaved, { reply_markup: mainMenuKeyboard(miniAppUrl()) });
        await enter(ctx, 'CATALOG', { history: [] });
        return;
      }
      case 'WEIGHT_CUSTOM': {
        const product = await getProduct(ctx.shop.id, draft.productId!);
        if (!product) return;
        const kg = Number(text.replace(',', '.'));
        if (!Number.isFinite(kg) || kg < product.minKg || kg > product.maxKg) {
          await ctx.reply(t.weightInvalid(product.minKg, product.maxKg));
          return;
        }
        draft.weightKg = Math.round(kg * 100) / 100;
        draft.optionGroupIndex = 0;
        await advanceOptions(ctx, draft, 'WEIGHT');
        return;
      }
      case 'INSCRIPTION_TEXT': {
        if (text.length > 40) {
          await ctx.reply(t.inscriptionTooLong);
          return;
        }
        draft.inscription = text;
        await enter(ctx, 'DATE', draft, 'INSCRIPTION');
        return;
      }
      case 'ADDRESS': {
        draft.addressText = text;
        await enter(ctx, 'ADDRESS_NOTE', draft, 'ADDRESS');
        return;
      }
      case 'ADDRESS_NOTE': {
        draft.addressNote = text;
        await enter(ctx, 'SUMMARY', draft, 'ADDRESS_NOTE');
        return;
      }
      case 'PAYMENT': {
        await ctx.reply(t.receiptNeedPhoto, MD);
        return;
      }
      default:
        return next();
    }
  });

  log.debug(`Mijoz handlerlari ulandi`);
}

export { formatKg };
