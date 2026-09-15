import type { Bot } from 'grammy';
import {
  blockDate,
  getProduct,
  getReport,
  getSession,
  getUsage,
  listAllProducts,
  listOrdersByDate,
  saveSession,
  setOrderStatus,
  setPaymentStatus,
  updateProduct,
  updateShop,
  clearSession,
  getOrder,
} from '../db/repo.js';
import { addDays, isValidDate, todayInTz } from '../services/dates.js';
import { notifyCustomerStatus, notifyCustomerText, refreshAdminCard } from '../services/notify.js';
import { at } from '../texts/admin-uz.js';
import { t } from '../texts/uz.js';
import type { OrderStatus } from '../types.js';
import type { BotContext } from './context.js';
import { adminMenuKeyboard, adminProductKeyboard, adminQuotaKeyboard } from './keyboards.js';

const MD = { parse_mode: 'Markdown' } as const;

function isAdmin(ctx: BotContext): boolean {
  const userId = ctx.from?.id;
  if (!userId) return false;
  if (ctx.shop.adminUserIds.includes(userId)) return true;
  // admin guruh ichidagi xabarlar ham admin harakati hisoblanadi
  return ctx.chat?.id !== undefined && ctx.chat.id === ctx.shop.adminGroupId;
}

async function guard(ctx: BotContext): Promise<boolean> {
  if (isAdmin(ctx)) return true;
  await ctx.reply(at.notAdmin);
  return false;
}

export function registerAdminHandlers(bot: Bot<BotContext>): void {
  /* --- sozlash uchun yordamchi: chat va user ID */
  bot.command('id', async (ctx) => {
    const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
    await ctx.reply(at.idInfo(ctx.chat.id, ctx.from?.id ?? 0, isGroup), MD);
  });

  bot.command('admin', async (ctx) => {
    if (!(await guard(ctx))) return;
    await ctx.reply(at.helpAdmin, MD);
  });

  bot.command('bugun', async (ctx) => {
    if (!(await guard(ctx))) return;
    const date = todayInTz(ctx.shop.timezone);
    await ctx.reply(at.ordersForDate(date, await listOrdersByDate(ctx.shop.id, date)), MD);
  });

  bot.command('ertaga', async (ctx) => {
    if (!(await guard(ctx))) return;
    const date = addDays(todayInTz(ctx.shop.timezone), 1);
    await ctx.reply(at.ordersForDate(date, await listOrdersByDate(ctx.shop.id, date)), MD);
  });

  bot.command('menu', async (ctx) => {
    if (!(await guard(ctx))) return;
    const products = await listAllProducts(ctx.shop.id);
    await ctx.reply(at.menuHeader, { ...MD, reply_markup: adminMenuKeyboard(products) });
  });

  bot.command('quota', async (ctx) => {
    if (!(await guard(ctx))) return;
    const date = todayInTz(ctx.shop.timezone);
    const usage = (await getUsage(ctx.shop.id, date, date)).get(date);
    await ctx.reply(at.quota(ctx.shop, usage?.usedKg ?? 0, usage?.usedOrders ?? 0, date), {
      ...MD,
      reply_markup: adminQuotaKeyboard(),
    });
  });

  bot.command('yopish', async (ctx) => {
    if (!(await guard(ctx))) return;
    await saveSession(ctx.shop.id, ctx.from!.id, 'ADMIN_BLOCK_DATE_INPUT', {});
    await ctx.reply(at.askBlockDate, MD);
  });

  bot.command('hisobot', async (ctx) => {
    if (!(await guard(ctx))) return;
    const r = await getReport(ctx.shop.id, 30);
    await ctx.reply(at.report({ days: 30, ...r }), MD);
  });

  /* --- buyurtma holati */
  bot.callbackQuery(/^a:st:(\d+):([A-Z_]+)$/, async (ctx) => {
    if (!isAdmin(ctx)) {
      await ctx.answerCallbackQuery({ text: at.notAdmin });
      return;
    }
    const orderId = Number(ctx.match![1]);
    const status = ctx.match![2] as OrderStatus;
    const order = await setOrderStatus(ctx.shop.id, orderId, status, 'admin', ctx.from!.id);
    await ctx.answerCallbackQuery({ text: '✅' });
    if (!order) return;
    await refreshAdminCard(order);
    await notifyCustomerStatus(order);
  });

  /* --- to'lov tasdig'i (chek-skrinshot varianti) */
  bot.callbackQuery(/^a:pay:(\d+):(ok|no)$/, async (ctx) => {
    if (!isAdmin(ctx)) {
      await ctx.answerCallbackQuery({ text: at.notAdmin });
      return;
    }
    const orderId = Number(ctx.match![1]);
    const ok = ctx.match![2] === 'ok';
    await setPaymentStatus(ctx.shop.id, orderId, ok ? 'paid' : 'rejected');
    const order = ok
      ? await setOrderStatus(ctx.shop.id, orderId, 'CONFIRMED', 'admin', ctx.from!.id)
      : await getOrder(ctx.shop.id, orderId);
    await ctx.answerCallbackQuery({ text: ok ? '✅ To\'lov tasdiqlandi' : '❌' });
    if (!order) return;
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

  /* --- katalog boshqaruvi */
  bot.callbackQuery('a:menu', async (ctx) => {
    if (!isAdmin(ctx)) return;
    await ctx.answerCallbackQuery();
    const products = await listAllProducts(ctx.shop.id);
    await ctx.editMessageText(at.menuHeader, {
      ...MD,
      reply_markup: adminMenuKeyboard(products),
    });
  });

  bot.callbackQuery(/^a:prod:(\d+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return;
    await ctx.answerCallbackQuery();
    const product = await getProduct(ctx.shop.id, Number(ctx.match![1]));
    if (!product) return;
    await ctx.editMessageText(at.productAdmin(product), {
      ...MD,
      reply_markup: adminProductKeyboard(product),
    });
  });

  bot.callbackQuery(/^a:price:(\d+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return;
    await ctx.answerCallbackQuery();
    const product = await getProduct(ctx.shop.id, Number(ctx.match![1]));
    if (!product) return;
    await saveSession(ctx.shop.id, ctx.from!.id, 'ADMIN_PRICE_INPUT', {
      targetProductId: product.id,
    });
    await ctx.reply(at.askNewPrice(product), MD);
  });

  bot.callbackQuery(/^a:avail:(\d+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return;
    const product = await getProduct(ctx.shop.id, Number(ctx.match![1]));
    if (!product) return;
    await updateProduct(ctx.shop.id, product.id, { is_available: !product.isAvailable });
    const updated = await getProduct(ctx.shop.id, product.id);
    await ctx.answerCallbackQuery({ text: updated ? at.availabilityToggled(updated) : '' });
    if (updated) {
      await ctx.editMessageText(at.productAdmin(updated), {
        ...MD,
        reply_markup: adminProductKeyboard(updated),
      });
    }
  });

  /* --- kunlik limit */
  bot.callbackQuery(/^a:quota:(orders|kg)$/, async (ctx) => {
    if (!isAdmin(ctx)) return;
    await ctx.answerCallbackQuery();
    const which = ctx.match![1];
    await saveSession(ctx.shop.id, ctx.from!.id, 'ADMIN_QUOTA_INPUT', {
      targetProductId: which === 'orders' ? 1 : 2,
    });
    await ctx.reply(which === 'orders' ? at.quotaAskOrders : at.quotaAskKg);
  });

  /* --- admin matn kiritishlari (customer handlerdan oldin ishlaydi) */
  bot.on('message:text', async (ctx, next) => {
    if (!ctx.from) return next();
    const { state, draft } = await getSession(ctx.shop.id, ctx.from.id);
    if (!state.startsWith('ADMIN_')) return next();
    if (!isAdmin(ctx)) return next();
    const text = ctx.message.text.trim();

    if (state === 'ADMIN_PRICE_INPUT') {
      const price = Number(text.replace(/[^\d]/g, ''));
      if (!Number.isFinite(price) || price <= 0) {
        await ctx.reply(at.priceInvalid);
        return;
      }
      await updateProduct(ctx.shop.id, draft.targetProductId!, { price_per_kg: price });
      await clearSession(ctx.shop.id, ctx.from.id);
      await ctx.reply(at.priceUpdated);
      return;
    }

    if (state === 'ADMIN_QUOTA_INPUT') {
      const value = Number(text.replace(',', '.').replace(/[^\d.]/g, ''));
      if (!Number.isFinite(value) || value <= 0) {
        await ctx.reply(at.priceInvalid);
        return;
      }
      const patch =
        draft.targetProductId === 1
          ? { daily_capacity_orders: Math.round(value) }
          : { daily_capacity_kg: value };
      await updateShop(ctx.shop.id, patch);
      Object.assign(ctx.shop, {
        dailyCapacityOrders:
          draft.targetProductId === 1 ? Math.round(value) : ctx.shop.dailyCapacityOrders,
        dailyCapacityKg: draft.targetProductId === 2 ? value : ctx.shop.dailyCapacityKg,
      });
      await clearSession(ctx.shop.id, ctx.from.id);
      await ctx.reply(at.quotaUpdated);
      return;
    }

    if (state === 'ADMIN_BLOCK_DATE_INPUT') {
      if (!isValidDate(text)) {
        await ctx.reply(at.dateInvalid, MD);
        return;
      }
      await blockDate(ctx.shop.id, text, 'admin');
      await clearSession(ctx.shop.id, ctx.from.id);
      await ctx.reply(at.dateBlocked(text));
      return;
    }

    return next();
  });
}
