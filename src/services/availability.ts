import { getUsage, type DayUsage } from '../db/repo.js';
import type { Shop } from '../types.js';
import { addDays, dateAfterHours, diffDays, isoWeekday, todayInTz } from './dates.js';

export interface AvailableDay {
  date: string;
  remainingOrders: number;
  remainingKg: number;
  /** tanlangan kg uchun necha dona sig'adi */
  slotsForRequest: number;
}

export interface AvailabilityParams {
  shop: Pick<
    Shop,
    'workingDays' | 'bookingHorizonDays' | 'dailyCapacityKg' | 'dailyCapacityOrders'
  >;
  /** eng erta ruxsat etilgan sana (lead_time_hours hisobga olingan) */
  earliestDate: string;
  /** oxirgi sana = today + booking_horizon_days */
  today: string;
  usage: Map<string, DayUsage>;
  requestedKg: number;
}

/**
 * Sof funksiya — bazaga bog'liq emas, shuning uchun test qilish oson.
 * PRD 6-bo'limdagi beshta shart shu yerda.
 */
export function computeAvailableDates(p: AvailabilityParams): AvailableDay[] {
  const out: AvailableDay[] = [];
  const lastDate = addDays(p.today, p.shop.bookingHorizonDays);
  const start = diffDays(p.earliestDate, p.today) > 0 ? p.today : p.earliestDate;

  for (let d = start; diffDays(d, lastDate) >= 0; d = addDays(d, 1)) {
    const usage = p.usage.get(d);
    if (usage?.isBlocked) continue;
    if (!p.shop.workingDays.includes(isoWeekday(d))) continue;

    const capKg = usage?.capacityKg ?? p.shop.dailyCapacityKg;
    const capOrders = usage?.capacityOrders ?? p.shop.dailyCapacityOrders;
    const remainingKg = capKg - (usage?.usedKg ?? 0);
    const remainingOrders = capOrders - (usage?.usedOrders ?? 0);

    if (remainingOrders < 1) continue;
    if (remainingKg < p.requestedKg) continue;

    out.push({
      date: d,
      remainingOrders,
      remainingKg,
      slotsForRequest: Math.min(remainingOrders, Math.floor(remainingKg / p.requestedKg)),
    });
  }
  return out;
}

/** Bazadan foydalanishni o'qib, bo'sh sanalarni qaytaradi. */
export async function getAvailableDates(
  shop: Shop,
  requestedKg: number,
  excludeTgId?: number,
): Promise<AvailableDay[]> {
  const today = todayInTz(shop.timezone);
  const earliestDate = dateAfterHours(shop.leadTimeHours, shop.timezone);
  const lastDate = addDays(today, shop.bookingHorizonDays);
  const usage = await getUsage(shop.id, today, lastDate, excludeTgId);
  return computeAvailableDates({ shop, earliestDate, today, usage, requestedKg });
}

/** Bitta sana hali ham bo'shmi (to'lov oldidan qayta tekshirish). */
export async function isDateStillFree(
  shop: Shop,
  date: string,
  requestedKg: number,
  excludeTgId?: number,
): Promise<boolean> {
  const days = await getAvailableDates(shop, requestedKg, excludeTgId);
  return days.some((d) => d.date === date);
}

export function effectiveCapacity(shop: Shop, usage?: DayUsage): { kg: number; orders: number } {
  return {
    kg: usage?.capacityKg ?? shop.dailyCapacityKg,
    orders: usage?.capacityOrders ?? shop.dailyCapacityOrders,
  };
}
