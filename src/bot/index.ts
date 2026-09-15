import { Bot } from 'grammy';
import { log } from '../config.js';
import { getShop } from '../db/repo.js';
import type { Shop } from '../types.js';
import { registerAdminHandlers } from './admin.js';
import { bots, type BotContext } from './context.js';
import { registerCustomerHandlers } from './customer.js';
import { registerPanelHandlers } from './panel.js';
import { at } from '../texts/admin-uz.js';
import { t } from '../texts/uz.js';

export function createBot(shop: Shop, token: string): Bot<BotContext> {
  const bot = new Bot<BotContext>(token);

  /**
   * Har bir yangilanishda do'kon sozlamalari bazadan o'qiladi.
   * Kritik qoida: barcha so'rovlar shu shop_id bo'yicha filtrlanadi (PRD 11.2).
   */
  bot.use(async (ctx, next) => {
    ctx.shop = (await getShop(shop.id)) ?? shop;
    await next();
  });

  bot.catch((err) => {
    log.error(`Bot xatosi (shop ${shop.id})`, err.error instanceof Error ? err.error.message : err.error);
  });

  // Tartib muhim: panel ADMIN_ holatidagi matnlarni va admin uchun /start ni ushlaydi,
  // shuning uchun mijoz handlerlaridan oldin ro'yxatdan o'tadi.
  registerPanelHandlers(bot);
  registerAdminHandlers(bot);
  registerCustomerHandlers(bot);

  bots.set(shop.id, bot);
  return bot;
}

/**
 * Mijozga faqat /start va /id ko'rinadi. Admin buyruqlari esa faqat admin chatlarida
 * (shaxsiy chat va admin guruh) menyuda chiqadi.
 */
export async function setBotCommands(bot: Bot<BotContext>, shop: Shop): Promise<void> {
  const set = async (
    commands: { command: string; description: string }[],
    scope?: { type: 'chat'; chat_id: number },
  ) => {
    try {
      await bot.api.setMyCommands(commands, scope ? { scope } : undefined);
    } catch (e) {
      log.warn('Buyruqlarni o\'rnatib bo\'lmadi', e instanceof Error ? e.message : e);
    }
  };

  await set([
    { command: 'start', description: t.cmdStart },
    { command: 'id', description: at.cmdId },
  ]);

  const fresh = (await getShop(shop.id)) ?? shop;
  const chats = [...fresh.adminUserIds, ...(fresh.adminGroupId ? [fresh.adminGroupId] : [])];
  for (const chatId of chats) {
    await set(at.adminCommands, { type: 'chat', chat_id: chatId });
  }
}
