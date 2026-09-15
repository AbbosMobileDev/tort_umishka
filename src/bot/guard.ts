import type { BotContext } from './context.js';
import { at } from '../texts/admin-uz.js';

/** Admin — do'kon egasi yoki admin guruh ichidagi harakat. */
export function isAdmin(ctx: BotContext): boolean {
  const userId = ctx.from?.id;
  if (!userId) return false;
  if (ctx.shop.adminUserIds.includes(userId)) return true;
  return ctx.chat?.id !== undefined && ctx.chat.id === ctx.shop.adminGroupId;
}

/** Panel faqat admin foydalanuvchining shaxsiy chatida ochiladi. */
export function isPanelUser(ctx: BotContext): boolean {
  return (
    ctx.chat?.type === 'private' &&
    ctx.from !== undefined &&
    ctx.shop.adminUserIds.includes(ctx.from.id)
  );
}

export async function guard(ctx: BotContext): Promise<boolean> {
  if (isAdmin(ctx)) return true;
  await ctx.reply(at.notAdmin);
  return false;
}
