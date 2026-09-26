/**
 * The order book's rules, with no screens attached: the cart at the
 * counter, totals, the queue's steps, how long someone's been waiting, and
 * a day in numbers. The server keeps the same rules (CONTRACT_order_book.txt).
 */
import { Cents } from '@/shared/lib/money';

import type { DayTotals, MenuItem, Order, OrderLine, OrderStatus, Payment } from '../types';

export const NAME_MAX = 30;
export const MAX_QTY = 50;
export const MAX_LINES = 20;

/** The cart at the counter: item id -> how many. */
export type Cart = Record<string, number>;

export function add(cart: Cart, itemId: string): Cart {
  return { ...cart, [itemId]: Math.min(MAX_QTY, (cart[itemId] ?? 0) + 1) };
}

export function remove(cart: Cart, itemId: string): Cart {
  const n = (cart[itemId] ?? 0) - 1;
  const next = { ...cart };
  if (n > 0) next[itemId] = n;
  else delete next[itemId];
  return next;
}

/** The cart as lines, in menu order, priced from the menu as it is now. */
export function lines(cart: Cart, menu: MenuItem[]): OrderLine[] {
  return menu.filter((m) => (cart[m.id] ?? 0) > 0).map((m) => ({ itemId: m.id, name: m.name, priceCents: m.priceCents, qty: cart[m.id]! }));
}

export function total(ls: OrderLine[]): Cents {
  return ls.reduce((sum, l) => sum + l.priceCents * l.qty, 0);
}

export function count(ls: OrderLine[]): number {
  return ls.reduce((n, l) => n + l.qty, 0);
}

/** "2 × Russian kota, Cold drink". */
export function linesText(ls: OrderLine[]): string {
  return ls.map((l) => (l.qty > 1 ? `${l.qty} × ${l.name}` : l.name)).join(', ');
}

/** The queue's one-tap step: New -> Preparing -> Ready -> Collected. */
export function nextStatus(s: OrderStatus): OrderStatus | null {
  return s === 'new' ? 'preparing' : s === 'preparing' ? 'ready' : s === 'ready' ? 'collected' : null;
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'New',
  preparing: 'Preparing',
  ready: 'Ready',
  collected: 'Collected',
  cancelled: 'Cancelled',
};

/** The button that moves an order on. */
export const NEXT_ACTION: Partial<Record<OrderStatus, string>> = { new: 'Start', preparing: 'Ready', ready: 'Collected' };

export const PAYMENT_LABEL: Record<Payment, string> = { cash: 'Cash', digital: 'Card or EFT', later: 'Pay later' };

/** "just now", "4 min", "1 h 5 min". */
export function waitingText(since: string, now: number = Date.now()): string {
  const min = Math.max(0, Math.floor((now - Date.parse(since)) / 60_000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
}

/** What the customer hears: "#12", or this phone's "A3" until the server numbers it. */
export function label(o: Pick<Order, 'number' | 'tempNumber'>): string {
  return o.number !== null ? `#${o.number}` : o.tempNumber;
}

/** Hour of the day in South Africa (UTC+2, no daylight saving). */
export function hourOf(iso: string): number {
  return (new Date(iso).getUTCHours() + 2) % 24;
}

/** A day in numbers. Cancelled orders don't count; "pay later" isn't money in yet. */
export function dayTotals(day: string, orders: Order[]): DayTotals {
  const real = orders.filter((o) => o.day === day && o.status !== 'cancelled');
  const sold = new Map<string, number>();
  const byHour = Array.from({ length: 24 }, () => 0);
  for (const o of real) {
    byHour[hourOf(o.createdAt)]! += 1;
    for (const l of o.lines) sold.set(l.name, (sold.get(l.name) ?? 0) + l.qty);
  }
  const sum = (p: Payment) => real.filter((o) => o.payment === p).reduce((s, o) => s + o.totalCents, 0);
  return {
    day,
    orders: real.length,
    cashCents: sum('cash'),
    digitalCents: sum('digital'),
    laterCents: sum('later'),
    bestSellers: [...sold.entries()].map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name)).slice(0, 3),
    byHour,
  };
}

/** "12:00 to 13:00" with the most orders, or null on a quiet day. */
export function busiestHour(t: DayTotals): { hour: number; orders: number; text: string } | null {
  let best = -1;
  t.byHour.forEach((n, h) => {
    if (n > 0 && (best < 0 || n > t.byHour[best]!)) best = h;
  });
  if (best < 0) return null;
  const pad = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;
  return { hour: best, orders: t.byHour[best]!, text: `${pad(best)} to ${pad(best + 1)}` };
}

/** Money the trader recorded as paid: cash, card or EFT (not "pay later"). Their own record, not proof. */
export function moneyIn(t: DayTotals): Cents {
  return t.cashCents + t.digitalCents;
}

export function cleanName(name: string): string | null {
  const v = name.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX);
  return /\p{L}/u.test(v) ? v : null;
}
