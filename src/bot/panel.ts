/**
 * Admin panel — do'kon egasining shaxsiy chatidagi tugmali interfeys.
 *
 * Guruhdagi kartalar oqimda ko'milib ketadi, shuning uchun bu yerda har bo'lim
 * bitta xabarni tahrirlab yangilanadi: buyurtma ro'yxati, karta, katalog, hisobot.
 * Callback prefikslari: `p:` — panel, `a:` — guruhdagi eski kartalar.
 */
import { InlineKeyboard, InputFile, type Bot } from 'grammy';
import { log } from '../config.js';
import {
  blockDate,
  clearSession,
  copyCategoryOptions,
  countOrdersByStatus,
  countOrdersOnDate,
  createCategory,
  createProduct,
  deleteProduct,
  getOrder,
  getProduct,
  getSession,
  getUsage,
  listAllCategories,
  listAllProducts,
  listOrdersByDate,
  listOrdersByStatuses,
  listOrdersInRange,
  saveSession,
  setOrderStatus,
  setPaymentStatus,
  unblockDate,
  updateProduct,
  updateShop,
} from '../db/repo.js';
import { addDays, isValidDate, todayInTz } from '../services/dates.js';
import { notifyCustomerStatus, notifyCustomerText, refreshAdminCard } from '../services/notify.js';
import {
  buildOrdersCsv,
  periodRange,
  summarize,
  type ReportPeriod,
} from '../services/report.js';
import { at } from '../texts/admin-uz.js';
import { t } from '../texts/uz.js';
import type { Draft, Order, OrderStatus, Shop } from '../types.js';
import type { BotContext } from './context.js';
import { isAdmin, isPanelUser } from './guard.js';
import {
  adminMenuKeyboard,
  adminPanelKeyboard,
  adminProductKeyboard,
  adminQuotaKeyboard,
  mainMenuKeyboard,
  panelCategoryKeyboard,
  panelDeleteKeyboard,
  panelHomeKeyboard,
  panelOrderFiltersKeyboard,
  panelOrderKeyboard,
  panelOrderListKeyboard,
  panelReportKeyboard,
  panelSettingsKeyboard,
  panelSkipPhotoKeyboard,
} from './keyboards.js';
import { miniAppUrl } from '../web/url.js';

const MD = { parse_mode: 'Markdown' } as const;

const NEW_STATUSES: OrderStatus[] = ['AWAITING_PAYMENT', 'CONFIRMED'];
const ACTIVE_STATUSES: OrderStatus[] = ['ACCEPTED', 'BAKING', 'READY', 'DELIVERING'];
const ARCHIVE_STATUSES: OrderStatus[] = ['COMPLETED', 'CANCELLED'];
const PERIODS: ReportPeriod[] = ['today', 'week', 'month', 'next'];

async function ans(ctx: BotContext, text?: string): Promise<void> {
  try {
    await ctx.answerCallbackQuery(text ? { text } : undefined);
  } catch {
    /* eskirgan callback — muhim emas */
  }
}

/**
 * Bo'limni ko'rsatadi: tugma bosilgan bo'lsa o'sha xabarni tahrirlaydi (eski ekranlar
 * to'planib qolmaydi), aks holda yangi xabar yuboradi.
 */
async function show(ctx: BotContext, text: string, kb: InlineKeyboard): Promise<void> {
  if (ctx.callbackQuery?.message) {
    try {
      await ctx.editMessageText(text, { ...MD, reply_markup: kb });
      return;
    } catch {
      /* matn o'zgarmagan yoki xabar rasmli — pastda yangisini yuboramiz */
    }
  }
  await ctx.reply(text, { ...MD, reply_markup: kb });
}

/* -------------------------------------------------------------- renderers */

export async function renderHome(ctx: BotContext): Promise<void> {
  await show(ctx, at.panelHome, panelHomeKeyboard());
}

async function filterCounts(shop: Shop): Promise<Record<string, number>> {
  const byStatus = await countOrdersByStatus(shop.id);
  const sum = (list: OrderStatus[]) => list.reduce((n, s) => n + (byStatus[s] ?? 0), 0);
  const today = todayInTz(shop.timezone);
  return {
    new: sum(NEW_STATUSES),
    act: sum(ACTIVE_STATUSES),
    tdy: await countOrdersOnDate(shop.id, today),
    tmw: await countOrdersOnDate(shop.id, addDays(today, 1)),
  };
}

export async function renderOrderFilters(ctx: BotContext): Promise<void> {
  await show(ctx, at.ordersHeader, panelOrderFiltersKeyboard(await filterCounts(ctx.shop)));
}

async function ordersFor(shop: Shop, filter: string): Promise<Order[]> {
  const today = todayInTz(shop.timezone);
  switch (filter) {
    case 'act':
      return listOrdersByStatuses(shop.id, ACTIVE_STATUSES, 'soon', 20);
    case 'tdy':
      return listOrdersByDate(shop.id, today);
    case 'tmw':
      return listOrdersByDate(shop.id, addDays(today, 1));
    case 'arc':
      return listOrdersByStatuses(shop.id, ARCHIVE_STATUSES, 'recent', 15);
    default:
      return listOrdersByStatuses(shop.id, NEW_STATUSES, 'recent', 20);
  }
}

export async function renderOrderList(ctx: BotContext, filter: string): Promise<void> {
  const orders = await ordersFor(ctx.shop, filter);
  if (!orders.length) {
    await show(ctx, at.ordersEmpty(filter), panelOrderListKeyboard([], filter));
    return;
  }
  await show(
    ctx,
    at.ordersListHeader(filter, orders.length),
    panelOrderListKeyboard(orders, filter),
  );
}

async function renderOrderCard(ctx: BotContext, order: Order, filter: string): Promise<void> {
  await show(ctx, at.newOrder(order), panelOrderKeyboard(order, filter));
}

export async function renderCatalog(ctx: BotContext): Promise<void> {
  await show(ctx, at.menuHeader, adminMenuKeyboard(await listAllProducts(ctx.shop.id)));
}

async function renderProduct(ctx: BotContext, productId: number): Promise<void> {
  const product = await getProduct(ctx.shop.id, productId);
  if (!product) return;
  await show(ctx, at.productAdmin(product), adminProductKeyboard(product));
}

export async function renderReport(ctx: BotContext, period?: ReportPeriod): Promise<void> {
  if (!period) {
    await show(ctx, at.reportHint, panelReportKeyboard());
    return;
  }
  const { from, to } = periodRange(period, todayInTz(ctx.shop.timezone), ctx.shop.bookingHorizonDays);
  const orders = await listOrdersInRange(ctx.shop.id, from, to);
  if (!orders.length) {
    await show(ctx, at.reportEmpty(period), panelReportKeyboard());
    return;
  }
  const s = summarize(orders);
  await show(ctx, at.reportBody({ periodKey: period, from, to, ...s }), panelReportKeyboard(period));
}

export async function renderSettings(ctx: BotContext): Promise<void> {
  await show(ctx, at.settingsHeader(ctx.shop, todayInTz(ctx.shop.timezone)), panelSettingsKeyboard());
}

export async function renderQuota(ctx: BotContext): Promise<void> {
  const date = todayInTz(ctx.shop.timezone);
  const usage = (await getUsage(ctx.shop.id, date, date)).get(date);
  await show(
    ctx,
    at.quota(ctx.shop, usage?.usedKg ?? 0, usage?.usedOrders ?? 0, date),
    adminQuotaKeyboard().row().text(at.btnBackPanel, 'p:set'),
  );
}

/* ------------------------------------------------------ yangi mahsulot oqimi */

async function askCategory(ctx: BotContext, draft: Draft): Promise<void> {
  const categories = await listAllCategories(ctx.shop.id);
  if (!categories.length) {
    await saveSession(ctx.shop.id, ctx.from!.id, 'ADMIN_CAT_NAME', draft);
    await ctx.reply(at.askCategoryName, MD);
    return;
  }
  await ctx.reply(at.askProductCategory(draft.newProduct?.name ?? ''), {
    ...MD,
    reply_markup: panelCategoryKeyboard(categories),
  });
}

async function askPhoto(ctx: BotContext, draft: Draft): Promise<void> {
  await saveSession(ctx.shop.id, ctx.from!.id, 'ADMIN_PROD_PHOTO', draft);
  await ctx.reply(at.askProductPhoto, { ...MD, reply_markup: panelSkipPhotoKeyboard() });
}

async function askPrice(ctx: BotContext, draft: Draft): Promise<void> {
  await saveSession(ctx.shop.id, ctx.from!.id, 'ADMIN_PROD_PRICE', draft);
  await ctx.reply(at.askProductPrice, MD);
}

/* ---------------------------------------------------------------- handlers */

export function registerPanelHandlers(bot: Bot<BotContext>): void {
  /** Panel tugmasi bosilganda tugallanmagan admin kiritishlari bekor qilinadi. */
  async function enterPanel(ctx: BotContext): Promise<boolean> {
    if (!isPanelUser(ctx)) return false;
    const { state } = await getSession(ctx.shop.id, ctx.from!.id);
    if (state.startsWith('ADMIN_')) await clearSession(ctx.shop.id, ctx.from!.id);
    return true;
  }

  /* --- kirish nuqtalari */
  bot.command('start', async (ctx, next) => {
    if (!isPanelUser(ctx)) return next();
    await clearSession(ctx.shop.id, ctx.from!.id);
    await ctx.reply(at.panelWelcome(ctx.shop.name), {
      ...MD,
      reply_markup: adminPanelKeyboard(),
    });
    await renderHome(ctx);
  });

  bot.command('panel', async (ctx) => {
    if (!isPanelUser(ctx)) {
      await ctx.reply(isAdmin(ctx) ? at.panelOnlyPrivate : at.notAdmin);
      return;
    }
    await enterPanel(ctx);
    await ctx.reply(at.panelWelcome(ctx.shop.name), {
      ...MD,
      reply_markup: adminPanelKeyboard(),
    });
    await renderHome(ctx);
  });

  /* --- doimiy menyu tugmalari */
  bot.hears(at.btnOrders, async (ctx, next) => {
    if (!(await enterPanel(ctx))) return next();
    await renderOrderFilters(ctx);
  });

  bot.hears(at.btnCatalog, async (ctx, next) => {
    if (!(await enterPanel(ctx))) return next();
    await renderCatalog(ctx);
  });

  bot.hears(at.btnReport, async (ctx, next) => {
    if (!(await enterPanel(ctx))) return next();
    await renderReport(ctx);
  });

  bot.hears(at.btnSettings, async (ctx, next) => {
    if (!(await enterPanel(ctx))) return next();
    await renderSettings(ctx);
  });

  bot.hears(at.btnCustomerMode, async (ctx, next) => {
    if (!(await enterPanel(ctx))) return next();
    await ctx.reply(at.customerMode, { reply_markup: mainMenuKeyboard(miniAppUrl()) });
  });

  /* --- navigatsiya */
  bot.callbackQuery('p:home', async (ctx) => {
    if (!isAdmin(ctx)) return ans(ctx, at.notAdmin);
    await ans(ctx);
    await renderHome(ctx);
  });

  /* --- buyurtmalar */
  bot.callbackQuery('p:ord', async (ctx) => {
    if (!isAdmin(ctx)) return ans(ctx, at.notAdmin);
    await ans(ctx);
    await renderOrderFilters(ctx);
  });

  bot.callbackQuery(/^p:ord:(\w+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return ans(ctx, at.notAdmin);
    await ans(ctx);
    await renderOrderList(ctx, ctx.match![1]);
  });

  bot.callbackQuery(/^p:o:(\d+):(\w+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return ans(ctx, at.notAdmin);
    await ans(ctx);
    const order = await getOrder(ctx.shop.id, Number(ctx.match![1]));
    if (!order) {
      await ctx.reply(at.orderNotFound);
      return;
    }
    await renderOrderCard(ctx, order, ctx.match![2]);
  });

  bot.callbackQuery(/^p:st:(\d+):([A-Z_]+):(\w+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return ans(ctx, at.notAdmin);
    const order = await setOrderStatus(
      ctx.shop.id,
      Number(ctx.match![1]),
      ctx.match![2] as OrderStatus,
      'admin',
      ctx.from!.id,
    );
    if (!order) return ans(ctx, at.orderNotFound);
    await ans(ctx, at.statusSaved(order));
    await renderOrderCard(ctx, order, ctx.match![3]);
    await refreshAdminCard(order);
    await notifyCustomerStatus(order);
  });

  bot.callbackQuery(/^p:pay:(\d+):(ok|no):(\w+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return ans(ctx, at.notAdmin);
    const orderId = Number(ctx.match![1]);
    const ok = ctx.match![2] === 'ok';
    await setPaymentStatus(ctx.shop.id, orderId, ok ? 'paid' : 'rejected');
    const order = ok
      ? await setOrderStatus(ctx.shop.id, orderId, 'CONFIRMED', 'admin', ctx.from!.id)
      : await getOrder(ctx.shop.id, orderId);
    if (!order) return ans(ctx, at.orderNotFound);
    await ans(ctx, ok ? at.payConfirmed : at.btnPayNo);
    await renderOrderCard(ctx, order, ctx.match![3]);
    await refreshAdminCard(order);
    if (ok) {
      await notifyCustomerStatus(order);
    } else if (order.customerTelegramId) {
      await notifyCustomerText(
        ctx.shop.id,
        order.customerTelegramId,
        t.paymentRejected(order.orderNumber),
      );
    }
  });

  /* --- katalog */
  bot.callbackQuery(['p:cat', 'a:menu'], async (ctx) => {
    if (!isAdmin(ctx)) return ans(ctx, at.notAdmin);
    await ans(ctx);
    await renderCatalog(ctx);
  });

  bot.callbackQuery(/^a:prod:(\d+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return ans(ctx, at.notAdmin);
    await ans(ctx);
    await renderProduct(ctx, Number(ctx.match![1]));
  });

  bot.callbackQuery(/^a:price:(\d+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return ans(ctx, at.notAdmin);
    await ans(ctx);
    const product = await getProduct(ctx.shop.id, Number(ctx.match![1]));
    if (!product) return;
    await saveSession(ctx.shop.id, ctx.from!.id, 'ADMIN_PRICE_INPUT', {
      targetProductId: product.id,
    });
    await ctx.reply(at.askNewPrice(product), MD);
  });

  bot.callbackQuery(/^a:avail:(\d+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return ans(ctx, at.notAdmin);
    const product = await getProduct(ctx.shop.id, Number(ctx.match![1]));
    if (!product) return ans(ctx);
    await updateProduct(ctx.shop.id, product.id, { is_available: !product.isAvailable });
    const updated = await getProduct(ctx.shop.id, product.id);
    await ans(ctx, updated ? at.availabilityToggled(updated) : undefined);
    if (updated) await show(ctx, at.productAdmin(updated), adminProductKeyboard(updated));
  });

  bot.callbackQuery(/^p:del:(\d+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return ans(ctx, at.notAdmin);
    await ans(ctx);
    const product = await getProduct(ctx.shop.id, Number(ctx.match![1]));
    if (!product) return;
    await show(ctx, at.deleteConfirm(product), panelDeleteKeyboard(product));
  });

  bot.callbackQuery(/^p:delok:(\d+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return ans(ctx, at.notAdmin);
    const product = await getProduct(ctx.shop.id, Number(ctx.match![1]));
    if (!product) return ans(ctx);
    await deleteProduct(ctx.shop.id, product.id);
    await ans(ctx, at.productDeleted(product.name));
    await renderCatalog(ctx);
  });

  /* --- yangi mahsulot: nomi -> kategoriya -> rasm -> narx */
  bot.callbackQuery('p:new', async (ctx) => {
    if (!isAdmin(ctx)) return ans(ctx, at.notAdmin);
    await ans(ctx);
    await saveSession(ctx.shop.id, ctx.from!.id, 'ADMIN_PROD_NAME', { newProduct: {} });
    await ctx.reply(at.askProductName, MD);
  });

  bot.callbackQuery(/^p:newcat:(\d+|new)$/, async (ctx) => {
    if (!isAdmin(ctx)) return ans(ctx, at.notAdmin);
    await ans(ctx);
    const { draft } = await getSession(ctx.shop.id, ctx.from!.id);
    if (!draft.newProduct?.name) {
      await ctx.reply(t.sessionExpired);
      return;
    }
    if (ctx.match![1] === 'new') {
      await saveSession(ctx.shop.id, ctx.from!.id, 'ADMIN_CAT_NAME', draft);
      await ctx.reply(at.askCategoryName, MD);
      return;
    }
    draft.newProduct.categoryId = Number(ctx.match![1]);
    await askPhoto(ctx, draft);
  });

  bot.callbackQuery('p:nophoto', async (ctx) => {
    if (!isAdmin(ctx)) return ans(ctx, at.notAdmin);
    await ans(ctx);
    const { state, draft } = await getSession(ctx.shop.id, ctx.from!.id);
    if (state !== 'ADMIN_PROD_PHOTO') return;
    await askPrice(ctx, draft);
  });

  /* --- hisobot */
  bot.callbackQuery('p:rep', async (ctx) => {
    if (!isAdmin(ctx)) return ans(ctx, at.notAdmin);
    await ans(ctx);
    await renderReport(ctx);
  });

  bot.callbackQuery(/^p:rep:(\w+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return ans(ctx, at.notAdmin);
    await ans(ctx);
    const period = ctx.match![1] as ReportPeriod;
    if (!PERIODS.includes(period)) return;
    await renderReport(ctx, period);
  });

  bot.callbackQuery(/^p:csv:(\w+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return ans(ctx, at.notAdmin);
    const period = ctx.match![1] as ReportPeriod;
    if (!PERIODS.includes(period)) return ans(ctx);
    await ans(ctx);
    const { from, to } = periodRange(
      period,
      todayInTz(ctx.shop.timezone),
      ctx.shop.bookingHorizonDays,
    );
    const orders = await listOrdersInRange(ctx.shop.id, from, to);
    if (!orders.length) {
      await ctx.reply(at.reportEmpty(period), MD);
      return;
    }
    const file = new InputFile(Buffer.from(buildOrdersCsv(orders), 'utf8'), at.csvFileName(from, to));
    await ctx.replyWithDocument(file, { caption: at.csvCaption(period, orders.length) });
  });

  /* --- sozlamalar */
  bot.callbackQuery('p:set', async (ctx) => {
    if (!isAdmin(ctx)) return ans(ctx, at.notAdmin);
    await ans(ctx);
    await renderSettings(ctx);
  });

  bot.callbackQuery('p:quota', async (ctx) => {
    if (!isAdmin(ctx)) return ans(ctx, at.notAdmin);
    await ans(ctx);
    await renderQuota(ctx);
  });

  bot.callbackQuery(/^a:quota:(orders|kg)$/, async (ctx) => {
    if (!isAdmin(ctx)) return ans(ctx, at.notAdmin);
    await ans(ctx);
    const which = ctx.match![1];
    await saveSession(ctx.shop.id, ctx.from!.id, 'ADMIN_QUOTA_INPUT', {
      targetProductId: which === 'orders' ? 1 : 2,
    });
    await ctx.reply(which === 'orders' ? at.quotaAskOrders : at.quotaAskKg);
  });

  bot.callbackQuery('p:block', async (ctx) => {
    if (!isAdmin(ctx)) return ans(ctx, at.notAdmin);
    await ans(ctx);
    await saveSession(ctx.shop.id, ctx.from!.id, 'ADMIN_BLOCK_DATE_INPUT', {});
    await ctx.reply(at.askBlockDate, MD);
  });

  bot.callbackQuery('p:unblock', async (ctx) => {
    if (!isAdmin(ctx)) return ans(ctx, at.notAdmin);
    await ans(ctx);
    await saveSession(ctx.shop.id, ctx.from!.id, 'ADMIN_UNBLOCK_DATE_INPUT', {});
    await ctx.reply(at.askUnblockDate, MD);
  });

  /* --- mahsulot rasmi (mijozning chek rasmidan oldin tekshiriladi) */
  bot.on('message:photo', async (ctx, next) => {
    if (!ctx.from || !isAdmin(ctx)) return next();
    const { state, draft } = await getSession(ctx.shop.id, ctx.from.id);
    if (state !== 'ADMIN_PROD_PHOTO') return next();
    draft.newProduct = {
      ...draft.newProduct,
      photoFileId: ctx.message.photo[ctx.message.photo.length - 1].file_id,
    };
    await ctx.reply(at.photoSaved);
    await askPrice(ctx, draft);
  });

  /* --- admin matn kiritishlari (mijoz handleridan oldin ishlaydi) */
  bot.on('message:text', async (ctx, next) => {
    if (!ctx.from) return next();
    const { state, draft } = await getSession(ctx.shop.id, ctx.from.id);
    if (!state.startsWith('ADMIN_')) return next();
    if (!isAdmin(ctx)) return next();
    const text = ctx.message.text.trim();
    if (text.startsWith('/')) return next();

    switch (state) {
      case 'ADMIN_PRICE_INPUT': {
        const price = Number(text.replace(/[^\d]/g, ''));
        if (!Number.isFinite(price) || price <= 0) {
          await ctx.reply(at.priceInvalid);
          return;
        }
        await updateProduct(ctx.shop.id, draft.targetProductId!, { price_per_kg: price });
        await clearSession(ctx.shop.id, ctx.from.id);
        await ctx.reply(at.priceUpdated);
        await renderProduct(ctx, draft.targetProductId!);
        return;
      }

      case 'ADMIN_QUOTA_INPUT': {
        const value = Number(text.replace(',', '.').replace(/[^\d.]/g, ''));
        if (!Number.isFinite(value) || value <= 0) {
          await ctx.reply(at.priceInvalid);
          return;
        }
        const isOrders = draft.targetProductId === 1;
        await updateShop(
          ctx.shop.id,
          isOrders
            ? { daily_capacity_orders: Math.round(value) }
            : { daily_capacity_kg: value },
        );
        Object.assign(ctx.shop, {
          dailyCapacityOrders: isOrders ? Math.round(value) : ctx.shop.dailyCapacityOrders,
          dailyCapacityKg: isOrders ? ctx.shop.dailyCapacityKg : value,
        });
        await clearSession(ctx.shop.id, ctx.from.id);
        await ctx.reply(at.quotaUpdated);
        return;
      }

      case 'ADMIN_BLOCK_DATE_INPUT':
      case 'ADMIN_UNBLOCK_DATE_INPUT': {
        if (!isValidDate(text)) {
          await ctx.reply(at.dateInvalid, MD);
          return;
        }
        const blocking = state === 'ADMIN_BLOCK_DATE_INPUT';
        if (blocking) await blockDate(ctx.shop.id, text, 'admin');
        else await unblockDate(ctx.shop.id, text);
        await clearSession(ctx.shop.id, ctx.from.id);
        await ctx.reply(blocking ? at.dateBlocked(text) : at.dateUnblocked(text));
        return;
      }

      case 'ADMIN_PROD_NAME': {
        if (text.length > 60) {
          await ctx.reply(at.nameTooLong);
          return;
        }
        draft.newProduct = { ...draft.newProduct, name: text };
        await saveSession(ctx.shop.id, ctx.from.id, 'ADMIN_PROD_NAME', draft);
        await askCategory(ctx, draft);
        return;
      }

      case 'ADMIN_CAT_NAME': {
        if (text.length > 60) {
          await ctx.reply(at.nameTooLong);
          return;
        }
        const category = await createCategory(ctx.shop.id, text);
        await ctx.reply(at.categoryCreated(category.name));
        draft.newProduct = { ...draft.newProduct, categoryId: category.id };
        await askPhoto(ctx, draft);
        return;
      }

      case 'ADMIN_PROD_PHOTO': {
        await ctx.reply(at.askProductPhoto, { ...MD, reply_markup: panelSkipPhotoKeyboard() });
        return;
      }

      case 'ADMIN_PROD_PRICE': {
        const price = Number(text.replace(/[^\d]/g, ''));
        if (!Number.isFinite(price) || price <= 0) {
          await ctx.reply(at.priceInvalid);
          return;
        }
        const np = draft.newProduct;
        if (!np?.name || !np.categoryId) {
          await clearSession(ctx.shop.id, ctx.from.id);
          await ctx.reply(t.sessionExpired);
          return;
        }
        const product = await createProduct(ctx.shop.id, {
          categoryId: np.categoryId,
          name: np.name,
          pricePerKg: price,
          photoFileId: np.photoFileId ?? null,
        });
        const copied = await copyCategoryOptions(ctx.shop.id, np.categoryId, product.id);
        await clearSession(ctx.shop.id, ctx.from.id);
        await ctx.reply(at.productCreated(product, copied), MD);
        await renderCatalog(ctx);
        return;
      }

      default:
        return next();
    }
  });

  log.debug('Admin panel handlerlari ulandi');
}
