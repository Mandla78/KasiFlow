/**
 * Months as My record shows them. "YYYY-MM", in South Africa's calendar
 * (UTC+2, no daylight saving), the same as the server's.
 */
const NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** This month in South Africa. */
export function thisMonth(now: number = Date.now()): string {
  const sa = new Date(now + 2 * 3_600_000);
  return `${sa.getUTCFullYear()}-${String(sa.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const i = y * 12 + (m - 1) + n;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
}

/** "September 2026". */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return `${NAMES[m - 1]} ${y}`;
}

/** "September". */
export function monthName(month: string): string {
  return NAMES[Number(month.split('-')[1]) - 1]!;
}

/** Is this ISO day or time in the month (South African calendar)? */
export function inMonth(iso: string, month: string): boolean {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso.startsWith(month);
  return thisMonth(Date.parse(iso)) === month;
}
