import { log } from '../config.js';
import { bots } from '../bot/context.js';
import { adminOrderKeyboard } from '../bot/keyboards.js';
import { getShop, setAdminMessageId } from '../db/repo.js';
import { at } from '../texts/admin-uz.js';
import { t } from '../texts/uz.js';
import type { Order } from '../types.js';

/** Telegram xatolarini yutadi — bildirishnoma tushmasa ham bot yiqilmasin. */
async function safe<T>(fn: () => Promise<T>, label: string): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    log.warn(`Telegram xatosi (${label})`, e instanceof Error ? e.message : e);
    return null;
  }
}

export async function notifyAdminNewOrder(order: Order): Promise<void> {
  const bot = bots.get(order.shopId);
  const shop = await getShop(order.shopId);
  if (!bot || !shop?.adminGroupId) {
    log.warn('Admin guruh sozlanmagan — buyurtma bildirishnomasi yuborilmadi');
    return;
  }
  const msg = await safe(
    () =>
      bot.api.sendMessage(shop.adminGroupId!, at.newOrder(order), {
        parse_mode: 'Markdown',
        reply_markup: adminOrderKeyboard(order),
      }),
    'newOrder',
  );
  if (msg) await setAdminMessageId(order.shopId, order.id, msg.message_id);
}

export async function notifyAdminReceipt(order: Order, photoFileId: string): Promise<void> {
  const bot = bots.get(order.shopId);
  const shop = await getShop(order.shopId);
  if (!bot || !shop?.adminGroupId) return;
  await safe(
    () =>
      bot.api.sendPhoto(shop.adminGroupId!, photoFileId, {
        caption: at.receiptCaption(order),
        reply_markup: adminOrderKeyboard(order),
      }),
    'receipt',
  );
}

export async function notifyAdminText(shopId: number, text: string): Promise<void> {
  const bot = bots.get(shopId);
  const shop = await getShop(shopId);
  if (!bot || !shop?.adminGroupId) return;
  await safe(
    () => bot.api.sendMessage(shop.adminGroupId!, text, { parse_mode: 'Markdown' }),
    'adminText',
  );
}

export async function notifyCustomerStatus(order: Order): Promise<void> {
  const bot = bots.get(order.shopId);
  if (!bot || !order.customerTelegramId) return;
  const text = t.statusMessage(order.status, order.orderNumber);
  if (!text) return;
  await safe(
    () => bot.api.sendMessage(order.customerTelegramId!, text),
    'customerStatus',
  );
}

export async function notifyCustomerText(
  shopId: number,
  telegramUserId: number,
  text: string,
): Promise<void> {
  const bot = bots.get(shopId);
  if (!bot) return;
  await safe(() => bot.api.sendMessage(telegramUserId, text), 'customerText');
}

/** Admin guruhdagi buyurtma kartasini yangi holat bilan yangilaydi. */
export async function refreshAdminCard(order: Order): Promise<void> {
  const bot = bots.get(order.shopId);
  const shop = await getShop(order.shopId);
  if (!bot || !shop?.adminGroupId || !order.adminMessageId) return;
  await safe(
    () =>
      bot.api.editMessageText(shop.adminGroupId!, order.adminMessageId!, at.newOrder(order), {
        parse_mode: 'Markdown',
        reply_markup: adminOrderKeyboard(order),
      }),
    'refreshAdminCard',
  );
}
