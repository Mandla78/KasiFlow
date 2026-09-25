/**
 * Calendar-day maths for due dates. Everything is an ISO day
 * ("2026-09-25") in the trader's own day, so "due today" means today on
 * their phone, not in UTC. Names are spelled out here instead of Intl,
 * which isn't complete on every Android phone.
 */

/** A pay-back date up to a year ahead; paper-book credit up to a year back (the server says the same). */
export const MAX_DAYS_AHEAD = 366;
export const MAX_DAYS_BACK = 366;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FRIDAY = 5;

const pad = (n: number) => String(n).padStart(2, '0');

export function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayIso(now: Date = new Date()): string {
  return toIso(now);
}

/** Local midnight of an ISO day. */
export function fromIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isIsoDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toIso(fromIso(value)) === value;
}

export function addDays(iso: string, days: number): string {
  const d = fromIso(iso);
  d.setDate(d.getDate() + days);
  return toIso(d);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  const [a, b] = [from, to].map((iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.round((b - a) / 86_400_000);
}

/** The next Friday after today (a week away when today is Friday: "Today" covers today). */
export function nextFriday(today: string): string {
  const day = fromIso(today).getDay();
  return addDays(today, ((FRIDAY - day + 7) % 7) || 7);
}

/** The last day of this month; next month's when today already is month-end. */
export function monthEnd(today: string): string {
  const d = fromIso(today);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  if (toIso(end) !== today) return toIso(end);
  return toIso(new Date(d.getFullYear(), d.getMonth() + 2, 0));
}

/** "Fri 2 Oct"; the year only when it isn't this year. */
export function shortDate(iso: string, today: string = todayIso()): string {
  const d = fromIso(iso);
  const base = `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === fromIso(today).getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

export function monthTitle(year: number, month: number): string {
  return `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month]} ${year}`;
}

export const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export type DueTone = 'late' | 'today' | 'soon' | 'later';

/** The list's due tag: "3 days late", "Due today", "Due Fri", "Month-end", "Next week", "Due 14 Oct". */
export function dueLabel(dueOn: string, today: string = todayIso()): { text: string; tone: DueTone } {
  const days = daysBetween(today, dueOn);
  if (days < 0) return { text: days === -1 ? '1 day late' : `${-days} days late`, tone: 'late' };
  if (days === 0) return { text: 'Due today', tone: 'today' };
  if (days === 1) return { text: 'Due tomorrow', tone: 'soon' };
  // Month-end is payday: say so, rather than the weekday.
  if (dueOn === monthEnd(today)) return { text: 'Month-end', tone: days < 7 ? 'soon' : 'later' };
  if (days < 7) return { text: `Due ${DAYS[fromIso(dueOn).getDay()]}`, tone: 'soon' };
  if (days < 14) return { text: 'Next week', tone: 'later' };
  const d = fromIso(dueOn);
  return { text: `Due ${d.getDate()} ${MONTHS[d.getMonth()]}`, tone: 'later' };
}

/** For messages: "today", "tomorrow", "on Fri 2 Oct". */
export function duePhrase(dueOn: string, today: string = todayIso()): string {
  const days = daysBetween(today, dueOn);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `on ${shortDate(dueOn, today)}`;
}
