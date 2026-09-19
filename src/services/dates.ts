const MONTHS_UZ = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
];

const WEEKDAYS_UZ = ['dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba', 'yakshanba'];

/** Berilgan momentni do'kon vaqt zonasidagi 'YYYY-MM-DD' sanasiga aylantiradi. */
export function dateInTz(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function todayInTz(timezone: string): string {
  return dateInTz(new Date(), timezone);
}

/** now + soat → o'sha momentdagi sana (lead time uchun). */
export function dateAfterHours(hours: number, timezone: string, from = new Date()): string {
  return dateInTz(new Date(from.getTime() + hours * 3600_000), timezone);
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** ISO hafta kuni: 1 = dushanba ... 7 = yakshanba */
export function isoWeekday(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 ? 7 : wd;
}

/** '2026-09-15' → '15-sentabr' */
export function formatDateUz(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${d}-${MONTHS_UZ[m - 1]}`;
}

/** '2026-09-15' → '15-sentabr, seshanba' */
export function formatDateLongUz(dateStr: string): string {
  return `${formatDateUz(dateStr)}, ${WEEKDAYS_UZ[isoWeekday(dateStr) - 1]}`;
}

/** '2026-09-15' → 'seshanba' (mini app sana kartochkalari uchun) */
export function weekdayUz(dateStr: string): string {
  return WEEKDAYS_UZ[isoWeekday(dateStr) - 1];
}

/** '2026-09-15' → 'sentabr' */
export function monthUz(dateStr: string): string {
  return MONTHS_UZ[Number(dateStr.split('-')[1]) - 1];
}

/** 1 → 'dushanba' (ish kunlari ro'yxati uchun) */
export function weekdayNameUz(isoDay: number): string {
  return WEEKDAYS_UZ[isoDay - 1] ?? '';
}

export function isValidDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
