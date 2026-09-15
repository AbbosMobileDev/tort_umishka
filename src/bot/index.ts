import { Bot } from 'grammy';
import { log } from '../config.js';
import { getShop } from '../db/repo.js';
import type { Shop } from '../types.js';
import { registerAdminHandlers } from './admin.js';
import { bots, type BotContext } from './context.js';
import { registerCustomerHandlers } from './customer.js';

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

  // Admin birinchi ro'yxatdan o'tadi: ADMIN_ holatidagi matnlarni u ushlaydi.
  registerAdminHandlers(bot);
  registerCustomerHandlers(bot);

  bots.set(shop.id, bot);
  return bot;
}

export async function setBotCommands(bot: Bot<BotContext>): Promise<void> {
  try {
    await bot.api.setMyCommands([
      { command: 'start', description: 'Boshlash' },
      { command: 'id', description: 'Chat ID ni ko\'rish' },
    ]);
  } catch (e) {
    log.warn('Buyruqlarni o\'rnatib bo\'lmadi', e instanceof Error ? e.message : e);
  }
}
