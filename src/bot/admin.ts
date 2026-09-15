/**
 * Admin guruh tomoni: buyruqlar va guruhdagi buyurtma kartasi tugmalari.
 * Tugmali panel (shaxsiy chat) — `panel.ts` da.
 */
import type { Bot } from 'grammy';
import {
  getReport,
  getOrder,
  listOrdersByDate,
  saveSession,
  setOrderStatus,
  setPaymentStatus,
} from '../db/repo.js';
import { addDays, todayInTz } from '../services/dates.js';
import { notifyCustomerStatus, notifyCustomerText, refreshAdminCard } from '../services/notify.js';
import { at } from '../texts/admin-uz.js';
import { t } from '../texts/uz.js';
import type { OrderStatus } from '../types.js';
import type { BotContext } from './context.js';
import { guard, isAdmin } from './guard.js';
import { renderCatalog, renderQuota } from './panel.js';

const MD = { parse_mode: 'Markdown' } as const;

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
    await renderCatalog(ctx);
  });

  bot.command('quota', async (ctx) => {
    if (!(await guard(ctx))) return;
    await renderQuota(ctx);
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

  /* --- buyurtma holati (guruhdagi karta) */
  bot.callbackQuery(/^a:st:(\d+):([A-Z_]+)$/, async (ctx) => {
    if (!isAdmin(ctx)) {
      await ctx.answerCallbackQuery({ text: at.notAdmin });
      return;
    }
    const orderId = Number(ctx.match![1]);
    const status = ctx.match![2] as OrderStatus;
    const order = await setOrderStatus(ctx.shop.id, orderId, status, 'admin', ctx.from!.id);
    await ctx.answerCallbackQuery({ text: order ? at.statusSaved(order) : at.orderNotFound });
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
    await ctx.answerCallbackQuery({ text: ok ? at.payConfirmed : at.btnPayNo });
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
}
