/**
 * MOCK order book: every screen works before the backend exists. It keeps
 * the contract's rules (CONTRACT_order_book.txt) and throws the server's
 * kind of errors, so a real orderBookApi changes no screen:
 *   - the server numbers the day's orders (#1, #2...), in arrival order
 *   - create is idempotent on the order's id: a retry returns the same order
 *   - lines are priced from the menu at the time (a snapshot)
 *   - the queue only moves forward; collected and cancelled are final
 * Kept on the phone (secure storage); memory only in the web preview.
 *
 * practice.setSignal(false) plays a dropped signal (every call fails like
 * a phone with no network), so the offline counter can be tried: marked
 * "Test" on screen.
 */
import * as SecureStore from 'expo-secure-store';

import { addDays, todayIso } from '@/features/dashboard/informal-business/credit-book/lib/dueDates';
import { ApiError } from '@/shared/api/client';

import { STARTERS, menuProblem } from '../lib/menus';
import { cleanName, dayTotals, MAX_LINES, MAX_QTY, nextStatus, total } from '../lib/orders';
import type { MenuItem, Order, OrderBookApi, OrderStatus } from '../types';

const KEY = 'akayza.mock-order-book.v1';
const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

type State = { menu: MenuItem[]; orders: Order[]; counters: Record<string, number> };

let state: State | null = null;
let signal = true;

/** An ISO time on `day` at hh:mm in South Africa (UTC+2). */
function at(day: string, hh: number, mm: number): string {
  return new Date(`${day}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+02:00`).toISOString();
}

/** A kota shop that has been trading this week, and a busy lunchtime today. */
function sample(): State {
  const menu: MenuItem[] = STARTERS[0]!.items.map((m, i) => ({ ...m, id: `item-${i + 1}` }));
  const byName = (n: string) => menu.find((m) => m.name.startsWith(n))!;
  const today = todayIso();
  const orders: Order[] = [];
  const counters: Record<string, number> = {};
  const make = (day: string, hh: number, mm: number, picks: [string, number][], payment: Order['payment'], status: OrderStatus, name: string | null = null, when?: string) => {
    counters[day] = (counters[day] ?? 0) + 1;
    const lines = picks.map(([n, qty]) => {
      const m = byName(n);
      return { itemId: m.id, name: m.name, priceCents: m.priceCents, qty };
    });
    const t = when ?? at(day, hh, mm);
    orders.push({ id: newId('ord'), number: counters[day]!, tempNumber: `A${counters[day]}`, day, lines, totalCents: total(lines), payment, customerName: name, status, createdAt: t, statusAt: t });
  };
  // The last six days: quieter mornings, a rush at lunch.
  for (let d = 6; d >= 1; d--) {
    const day = addDays(today, -d);
    const n = 14 + ((d * 5) % 9);
    for (let i = 0; i < n; i++) {
      const hh = [10, 11, 12, 12, 12, 13, 13, 14, 16, 17][i % 10]!;
      const pick: [string, number][] = i % 3 === 0 ? [['Russian kota', 1], ['Cold drink', 1]] : i % 3 === 1 ? [['Kota: chips', 2]] : [['Full house', 1], ['Chips large', 1]];
      make(day, hh, (i * 7) % 60, pick, i % 4 === 0 ? 'digital' : i % 9 === 0 ? 'later' : 'cash', 'collected');
    }
  }
  // Today so far: in the hours before now (never in the future, never yesterday).
  const dayStart = Date.parse(at(today, 0, 1));
  const ago = (min: number) => new Date(Math.max(dayStart, Date.now() - min * 60_000)).toISOString();
  make(today, 0, 0, [['Kota: chips', 1]], 'cash', 'collected', null, ago(150));
  make(today, 0, 0, [['Russian kota', 2], ['Cold drink', 2]], 'digital', 'collected', null, ago(120));
  make(today, 0, 0, [['Full house', 1]], 'cash', 'collected', null, ago(95));
  make(today, 0, 0, [['Kota: chips', 3]], 'cash', 'collected', null, ago(60));
  make(today, 0, 0, [['Russian kota', 1], ['Chips small', 1]], 'later', 'collected', 'Sipho', ago(35));
  return { menu, orders, counters };
}

async function load(): Promise<State> {
  if (state) return state;
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    state = raw ? (JSON.parse(raw) as State) : sample();
  } catch {
    state = sample(); // web preview: memory only
  }
  return state;
}

async function save(next: State) {
  state = next;
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(next));
  } catch {
    // web preview
  }
}

/** Like fetch with no network: not an ApiError, so the counter keeps it to send later. */
function reach() {
  if (!signal) throw new TypeError('Network request failed');
}

function invalid(field: string, message: string): never {
  throw new ApiError(422, 'VALIDATION_ERROR', message, { errors: { [field]: [message] } });
}

function notFound(): never {
  throw new ApiError(404, 'NOT_FOUND', "We couldn't find that order.");
}

const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export const mockOrderBookApi: OrderBookApi = {
  async menu() {
    await wait();
    reach();
    return copy((await load()).menu);
  },

  async saveMenu(items) {
    await wait();
    reach();
    const problem = menuProblem(items);
    if (problem) invalid('items', problem);
    const s = await load();
    const menu = items.map((it) => ({ id: it.id && s.menu.some((m) => m.id === it.id) ? it.id : newId('item'), name: it.name.trim().replace(/\s+/g, ' '), priceCents: it.priceCents, ingredients: [...new Set(it.ingredients)] }));
    await save({ ...s, menu });
    return copy(menu);
  },

  async orders(day) {
    await wait();
    reach();
    return copy((await load()).orders.filter((o) => o.day === day));
  },

  async create(input) {
    await wait();
    reach();
    const s = await load();
    const existing = s.orders.find((o) => o.id === input.id);
    if (existing) return copy(existing); // a retry: the same order, the same number
    if (input.lines.length < 1 || input.lines.length > MAX_LINES) invalid('lines', 'Add something to the order.');
    const lines = input.lines.map((l) => {
      const m = s.menu.find((x) => x.id === l.itemId) ?? invalid('lines', "That item isn't on the menu any more.");
      if (!Number.isInteger(l.qty) || l.qty < 1 || l.qty > MAX_QTY) invalid('lines', `1 to ${MAX_QTY} of each item.`);
      return { itemId: m.id, name: m.name, priceCents: m.priceCents, qty: l.qty };
    });
    if (!['cash', 'digital', 'later'].includes(input.payment)) invalid('payment', 'Pick how they paid.');
    const number = (s.counters[input.day] ?? 0) + 1;
    const order: Order = {
      id: input.id,
      number,
      tempNumber: input.tempNumber,
      day: input.day,
      lines,
      totalCents: total(lines),
      payment: input.payment,
      customerName: input.customerName ? cleanName(input.customerName) : null,
      status: 'new',
      createdAt: input.createdAt,
      statusAt: input.createdAt,
    };
    await save({ ...s, orders: [...s.orders, order], counters: { ...s.counters, [input.day]: number } });
    return copy(order);
  },

  async setStatus(id, status, when) {
    await wait();
    reach();
    const s = await load();
    const o = s.orders.find((x) => x.id === id) ?? notFound();
    if (o.status === status) return copy(o);
    const allowed = status === 'cancelled' ? o.status !== 'collected' && o.status !== 'cancelled' : nextStatus(o.status) === status;
    if (!allowed) throw new ApiError(409, 'WRONG_STEP', `This order is already ${o.status}.`);
    o.status = status;
    o.statusAt = when;
    await save(s);
    return copy(o);
  },

  async week(endDay) {
    await wait();
    reach();
    const s = await load();
    return Array.from({ length: 7 }, (_, i) => dayTotals(addDays(endDay, i - 6), s.orders));
  },
};

/** TEST ONLY (mock): play a dropped signal. */
export const practice = {
  setSignal(on: boolean) {
    signal = on;
  },
  get signal() {
    return signal;
  },
};
