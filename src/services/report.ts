/**
 * Hisobot: davr oralig'i, jamlanma va CSV fayl.
 * Sof funksiyalar — bazasiz testlanadi. Summalar butun sonda (so'm).
 */
import { at } from '../texts/admin-uz.js';
import { statusUz } from '../texts/uz.js';
import type { Order } from '../types.js';
import { addDays } from './dates.js';

export type ReportPeriod = 'today' | 'week' | 'month' | 'next';

export interface ReportSummary {
  orders: number;
  kg: number;
  som: number;
  prepaid: number;
  cancelled: number;
  topProducts: { name: string; count: number }[];
}

/** Davr -> sana oralig'i. Sanalar har doim 'YYYY-MM-DD' satr. */
export function periodRange(
  period: ReportPeriod,
  today: string,
  horizonDays: number,
): { from: string; to: string } {
  switch (period) {
    case 'today':
      return { from: today, to: today };
    case 'week':
      return { from: addDays(today, -6), to: today };
    case 'month':
      return { from: addDays(today, -29), to: today };
    case 'next':
      return { from: addDays(today, 1), to: addDays(today, Math.max(1, horizonDays)) };
  }
}

/** Bekor qilinganlar summaga kirmaydi, lekin alohida sanaladi. */
export function summarize(orders: Order[]): ReportSummary {
  const active = orders.filter((o) => o.status !== 'CANCELLED');
  const byProduct = new Map<string, number>();
  for (const o of active) {
    const name = o.productSnapshot.name;
    byProduct.set(name, (byProduct.get(name) ?? 0) + 1);
  }
  return {
    orders: active.length,
    kg: Math.round(active.reduce((s, o) => s + o.weightKg, 0) * 100) / 100,
    som: active.reduce((s, o) => s + o.total, 0),
    prepaid: active
      .filter((o) => o.paymentStatus === 'paid')
      .reduce((s, o) => s + o.prepaidAmount, 0),
    cancelled: orders.length - active.length,
    topProducts: [...byProduct.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 5),
  };
}

const SEP = ';';

function cell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Excel va Google Sheets ochadigan CSV. Ajratgich — nuqta-vergul (Excel'ning uz/ru
 * lokalida shu kutiladi), boshida BOM — kirill va o'zbek harflari buzilmasin.
 */
export function buildOrdersCsv(orders: Order[]): string {
  const rows = [at.csvHeader];
  for (const o of orders) {
    rows.push([
      `#${o.orderNumber}`,
      o.pickupDate,
      o.pickupTimeSlot ?? '',
      o.productSnapshot.name,
      String(o.weightKg),
      o.optionsSnapshot.map((x) => `${x.groupName}: ${x.optionName}`).join(', '),
      o.inscriptionText ?? '',
      o.deliveryType === 'delivery' ? 'Yetkazish' : 'Olib ketish',
      [o.addressText, o.addressNote].filter(Boolean).join(' / '),
      o.customerName ?? '',
      o.customerPhone ?? '',
      String(o.total),
      String(o.prepaidAmount),
      String(o.remainingAmount),
      o.paymentStatus === 'paid' ? 'to\'landi' : o.paymentStatus,
      statusUz(o.status),
    ]);
  }
  return `﻿${rows.map((r) => r.map(cell).join(SEP)).join('\r\n')}\r\n`;
}
