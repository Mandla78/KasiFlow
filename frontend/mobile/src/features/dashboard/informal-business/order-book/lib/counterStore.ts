/**
 * The counter: today's orders, the menu, and what hasn't reached the
 * server yet -- in one place every order-book screen reads
 * (useCounter()). Only these functions change it.
 *
 * Offline first: an order is on the screen (with this phone's number, "A3")
 * the moment it's taken, and goes to the server when it can (lib/outbox.ts).
 * The unsent part is kept on the phone, so a restart loses nothing.
 */
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

import { todayIso } from '@/features/dashboard/informal-business/credit-book/lib/dueDates';
import { ApiError } from '@/shared/api/client';

import { orderBookApi } from '../api/orderBookApi';
import type { MenuItem, Order, OrderLine, OrderStatus, Payment } from '../types';
import { newOrderKey } from './keys';
import { cleanName, total } from './orders';
import { Entry, flush, merge, unsentIds } from './outbox';

const KEY = 'akayza.order-book.counter.v1';

/** This phone's letter for numbers it gives before the server does (two phones: A and B). */
export const LETTERS = ['A', 'B', 'C', 'D'];

type Kept = { day: string; local: Order[]; outbox: Entry[]; temp: number; letter: string };

export type CounterState = {
  day: string;
  menu: MenuItem[] | null;
  orders: Order[];
  /** Order ids the server doesn't have yet. */
  unsent: Set<string>;
  /** Waiting to send (orders and queue steps). */
  waiting: number;
  offline: boolean;
  loading: boolean;
  failed: boolean;
  /** The server refused something (the reason, to show once). */
  refused: string | null;
  letter: string;
};

let kept: Kept = { day: todayIso(), local: [], outbox: [], temp: 0, letter: 'A' };
let server: Order[] = [];
let menu: MenuItem[] | null = null;
let offline = false;
let loading = false;
let failed = false;
let refused: string | null = null;
let restored = false;
let flushing: Promise<void> | null = null;
let snapshot: CounterState = build();
const listeners = new Set<() => void>();

function build(): CounterState {
  return {
    day: kept.day,
    menu,
    orders: merge(server, kept.local, kept.outbox),
    unsent: unsentIds(kept.outbox),
    waiting: kept.outbox.length,
    offline,
    loading,
    failed,
    refused,
    letter: kept.letter,
  };
}

function emit() {
  snapshot = build();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

async function persist() {
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(kept));
  } catch {
    // web preview: memory only
  }
}

async function restore() {
  if (restored) return;
  restored = true;
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (raw) kept = JSON.parse(raw) as Kept;
  } catch {
    // web preview
  }
}

/** A new day starts with an empty counter (yesterday's unsent orders still go). */
function roll(today: string) {
  if (kept.day !== today) {
    const unsent = unsentIds(kept.outbox);
    kept = { ...kept, day: today, temp: 0, local: kept.local.filter((o) => unsent.has(o.id)) };
    server = [];
  }
}

/** Open the counter: the menu and today's orders from the server, then send what's waiting. */
export async function open(): Promise<void> {
  await restore();
  roll(todayIso());
  loading = true;
  failed = false;
  emit();
  try {
    const [m, o] = await Promise.all([orderBookApi.menu(), orderBookApi.orders(kept.day)]);
    menu = m;
    server = o;
    offline = false;
  } catch (err) {
    // No signal: work from what the phone has. A refusal is a real failure.
    if (err instanceof ApiError && err.status < 500) failed = true;
    else offline = true;
  } finally {
    loading = false;
    emit();
  }
  await send();
}

/** Try to send everything waiting, in order (one at a time, never twice at once). */
export function send(): Promise<void> {
  if (!flushing) {
    flushing = (async () => {
      const started = kept.outbox;
      if (started.length === 0) return;
      const r = await flush(started, orderBookApi);
      for (const o of r.sent) {
        server = [...server.filter((x) => x.id !== o.id), o];
      }
      // Orders taken while we were sending are still waiting, after what's left.
      const outbox = [...r.left, ...kept.outbox.slice(started.length)];
      const pending = new Set(outbox.map((e) => (e.kind === 'create' ? e.order.id : e.id)));
      kept = { ...kept, outbox, local: kept.local.filter((o) => pending.has(o.id)) };
      offline = r.offline;
      if (r.refused.length) refused = r.refused[0]!.message;
      await persist();
      emit();
    })().finally(() => {
      flushing = null;
      if (kept.outbox.length > 0 && !offline) void send();
    });
  }
  return flushing;
}

/** Take an order: on screen at once, sent when it can be. */
export async function take(lines: OrderLine[], payment: Payment, customerName: string): Promise<Order> {
  roll(todayIso());
  const now = new Date().toISOString();
  const temp = kept.temp + 1;
  const order: Order = {
    id: newOrderKey(),
    number: null,
    tempNumber: `${kept.letter}${temp}`,
    day: kept.day,
    lines,
    totalCents: total(lines),
    payment,
    customerName: cleanName(customerName),
    status: 'new',
    createdAt: now,
    statusAt: now,
  };
  const entry: Entry = {
    kind: 'create',
    order: { id: order.id, day: order.day, tempNumber: order.tempNumber, lines: lines.map((l) => ({ itemId: l.itemId, qty: l.qty })), payment, customerName: order.customerName, createdAt: now },
  };
  kept = { ...kept, temp, local: [...kept.local, order], outbox: [...kept.outbox, entry] };
  await persist();
  emit();
  void send();
  return order;
}

/** Move an order on (or cancel it): on screen at once, sent when it can be. */
export async function step(order: Order, status: OrderStatus): Promise<void> {
  const now = new Date().toISOString();
  const moved = { ...order, status, statusAt: now };
  kept = {
    ...kept,
    local: [...kept.local.filter((o) => o.id !== order.id), moved],
    outbox: [...kept.outbox, { kind: 'status', id: order.id, status, at: now }],
  };
  await persist();
  emit();
  void send();
}

export async function saveMenu(items: Parameters<typeof orderBookApi.saveMenu>[0]): Promise<MenuItem[]> {
  menu = await orderBookApi.saveMenu(items);
  emit();
  return menu;
}

export async function setLetter(letter: string) {
  if (!LETTERS.includes(letter)) return;
  kept = { ...kept, letter };
  await persist();
  emit();
}

export function forgetRefused() {
  refused = null;
  emit();
}

export function useCounter(): CounterState {
  return useSyncExternalStore(subscribe, () => snapshot);
}
