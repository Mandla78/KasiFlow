/**
 * Help posts in few words: "Plumber needed" / "Ivory Park · 3.1 km · from
 * Mon 28 Sep · 2 days". Dates are ISO days, "today" in Johannesburg.
 */
import { addDays, daysBetween, todayIso } from '@/features/dashboard/informal-business/credit-book/lib/dueDates';

import { kmText } from './recommend';
import { tradeLabel, type Trade } from './trades';

export function neededText(trade: Trade): string {
  return `${tradeLabel(trade)} needed`;
}

export function daysText(days: number): string {
  return days === 1 ? '1 day' : `${days} days`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Mon 28 Sep", the same on every phone (locales write "Sept", "Mon,"...). */
export function shortDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[weekday]} ${d} ${MONTHS[m - 1]}`;
}

/** A moment as "28 Sep 2026", on the phone's clock. */
export function dateText(isoTime: string): string {
  const d = new Date(isoTime);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "today", "tomorrow", "Mon 28 Sep". */
export function dayText(iso: string, today: string = todayIso()): string {
  const ahead = daysBetween(today, iso);
  if (ahead === 0) return 'today';
  if (ahead === 1) return 'tomorrow';
  return shortDay(iso);
}

/** "Ivory Park · 3.1 km · from Mon 28 Sep · 2 days" (no distance on your own post). */
export function postDetails(post: { suburb: string; distanceKm: number; startsOn: string; days: number; mine: boolean }, today: string = todayIso()): string {
  const parts = [post.suburb];
  if (!post.mine) parts.push(kmText(post.distanceKm));
  parts.push(`from ${dayText(post.startsOn, today)}`, daysText(post.days));
  return parts.join(' · ');
}

/** The next 14 days to start on, for the chips on a new post. */
export function startChoices(today: string = todayIso()): { iso: string; label: string }[] {
  return Array.from({ length: 14 }, (_, i) => {
    const iso = addDays(today, i);
    const label = dayText(iso, today);
    return { iso, label: label[0]!.toUpperCase() + label.slice(1) };
  });
}
