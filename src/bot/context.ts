import type { Bot, Context } from 'grammy';
import type { Shop } from '../types.js';

export interface BotContext extends Context {
  shop: Shop;
}

/** shop_id -> bot instansiyasi. Cron joblar shu yerdan botni topadi. */
export const bots = new Map<number, Bot<BotContext>>();
