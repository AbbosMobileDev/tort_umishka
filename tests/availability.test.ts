import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeAvailableDates } from '../src/services/availability.js';
import type { DayUsage } from '../src/db/repo.js';
import { addDays, formatDateUz, isoWeekday } from '../src/services/dates.js';

const shop = {
  workingDays: [1, 2, 3, 4, 5, 6], // yakshanba dam
  bookingHorizonDays: 7,
  dailyCapacityKg: 25,
  dailyCapacityOrders: 8,
};

// 2026-09-14 = dushanba
const TODAY = '2026-09-14';

function usageMap(entries: Partial<DayUsage>[]): Map<string, DayUsage> {
  const m = new Map<string, DayUsage>();
  for (const e of entries) {
    m.set(e.date!, {
      date: e.date!,
      usedKg: e.usedKg ?? 0,
      usedOrders: e.usedOrders ?? 0,
      capacityKg: e.capacityKg ?? null,
      capacityOrders: e.capacityOrders ?? null,
      isBlocked: e.isBlocked ?? false,
    });
  }
  return m;
}

test('yakshanba ro\'yxatga tushmaydi', () => {
  const days = computeAvailableDates({
    shop,
    today: TODAY,
    earliestDate: TODAY,
    usage: usageMap([]),
    requestedKg: 2,
  });
  assert.equal(days.length, 7); // 8 kundan yakshanba chiqib ketadi
  assert.ok(days.every((d) => isoWeekday(d.date) !== 7));
});

test('lead time dan oldingi kunlar ko\'rinmaydi', () => {
  const earliest = addDays(TODAY, 2);
  const days = computeAvailableDates({
    shop,
    today: TODAY,
    earliestDate: earliest,
    usage: usageMap([]),
    requestedKg: 2,
  });
  assert.equal(days[0].date, earliest);
  assert.ok(!days.some((d) => d.date < earliest));
});

test('buyurtmalar soni to\'lgan kun chiqmaydi', () => {
  const full = addDays(TODAY, 1);
  const days = computeAvailableDates({
    shop,
    today: TODAY,
    earliestDate: TODAY,
    usage: usageMap([{ date: full, usedOrders: 8, usedKg: 10 }]),
    requestedKg: 2,
  });
  assert.ok(!days.some((d) => d.date === full));
});

test('kg quvvati yetmasa o\'sha kun chiqmaydi, kichikroq kg uchun chiqadi', () => {
  const nearly = addDays(TODAY, 1);
  const usage = usageMap([{ date: nearly, usedKg: 23, usedOrders: 3 }]);

  const forThree = computeAvailableDates({ shop, today: TODAY, earliestDate: TODAY, usage, requestedKg: 3 });
  assert.ok(!forThree.some((d) => d.date === nearly));

  const forTwo = computeAvailableDates({ shop, today: TODAY, earliestDate: TODAY, usage, requestedKg: 2 });
  assert.ok(forTwo.some((d) => d.date === nearly));
});

test('yopilgan sana chiqmaydi', () => {
  const blocked = addDays(TODAY, 3);
  const days = computeAvailableDates({
    shop,
    today: TODAY,
    earliestDate: TODAY,
    usage: usageMap([{ date: blocked, isBlocked: true }]),
    requestedKg: 1,
  });
  assert.ok(!days.some((d) => d.date === blocked));
});

test('bayram rejimi: override capacity kuchga kiradi', () => {
  const holiday = addDays(TODAY, 2);
  const usage = usageMap([
    { date: holiday, usedKg: 24, usedOrders: 8, capacityKg: 60, capacityOrders: 20 },
  ]);
  const days = computeAvailableDates({ shop, today: TODAY, earliestDate: TODAY, usage, requestedKg: 3 });
  const day = days.find((d) => d.date === holiday);
  assert.ok(day, 'bayram kuni ro\'yxatda bo\'lishi kerak');
  assert.equal(day!.remainingOrders, 12);
  assert.equal(day!.remainingKg, 36);
});

test('qolgan o\'rin = MIN(buyurtma, kg / tanlangan kg)', () => {
  const d = addDays(TODAY, 1);
  const days = computeAvailableDates({
    shop,
    today: TODAY,
    earliestDate: TODAY,
    usage: usageMap([{ date: d, usedKg: 19, usedOrders: 1 }]),
    requestedKg: 2,
  });
  const day = days.find((x) => x.date === d)!;
  assert.equal(day.remainingKg, 6);
  assert.equal(day.remainingOrders, 7);
  assert.equal(day.slotsForRequest, 3); // floor(6/2)
});

test('sana formatlash o\'zbekcha', () => {
  assert.equal(formatDateUz('2026-09-15'), '15-sentabr');
  assert.equal(formatDateUz('2026-03-08'), '8-mart');
});
