import cron from 'node-cron';
import { log } from '../config.js';
import {
  cleanupExpiredHolds,
  countOrdersOnDate,
  deleteExpiredSessions,
  listActiveShops,
  listOrdersByDate,
  listOrdersForReminder,
} from '../db/repo.js';
import { addDays, todayInTz } from '../services/dates.js';
import { notifyAdminText, notifyCustomerText } from '../services/notify.js';
import { at } from '../texts/admin-uz.js';
import { t } from '../texts/uz.js';

async function sendDailyPlan(): Promise<void> {
  for (const shop of await listActiveShops()) {
    const today = todayInTz(shop.timezone);
    const orders = await listOrdersByDate(shop.id, today);
    const tomorrow = await countOrdersOnDate(shop.id, addDays(today, 1));
    await notifyAdminText(shop.id, at.dailyPlan(today, orders, tomorrow));
  }
}

async function sendDayBeforeReminders(): Promise<void> {
  for (const shop of await listActiveShops()) {
    const tomorrow = addDays(todayInTz(shop.timezone), 1);
    const orders = await listOrdersForReminder(shop.id, tomorrow);
    for (const o of orders) {
      if (!o.customerTelegramId) continue;
      await notifyCustomerText(shop.id, o.customerTelegramId, t.reminderDayBefore(o));
    }
    if (orders.length) log.info(`Eslatma yuborildi: ${orders.length} ta (shop ${shop.id})`);
  }
}

async function cleanup(): Promise<void> {
  const holds = await cleanupExpiredHolds();
  const sessions = await deleteExpiredSessions();
  if (holds || sessions) log.debug(`Tozalash: ${holds} rezerv, ${sessions} sessiya`);
}

export function startJobs(timezone: string): void {
  const opts = { timezone };
  cron.schedule('0 8 * * *', () => void sendDailyPlan().catch((e) => log.error('dailyPlan', e)), opts);
  cron.schedule(
    '0 18 * * *',
    () => void sendDayBeforeReminders().catch((e) => log.error('reminders', e)),
    opts,
  );
  cron.schedule('*/5 * * * *', () => void cleanup().catch((e) => log.error('cleanup', e)), opts);
  log.info('Cron joblar ishga tushdi (08:00 reja, 18:00 eslatma, 5 daq. tozalash)');
}

export const __testables = { sendDailyPlan, sendDayBeforeReminders, cleanup };
