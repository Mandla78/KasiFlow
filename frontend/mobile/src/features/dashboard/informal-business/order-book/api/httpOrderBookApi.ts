/**
 * The order book on the server (/me/order-book). snake_case on the wire is
 * mapped to the app's camelCase here and nowhere else, so no screen knows
 * which API it's talking to. An order's "id" is the phone's own key for
 * it: the same on every retry, so a retry lands once (201 the first time,
 * 200 with the same order after).
 */
import { api } from '@/shared/api/client';

import type { DayTotals, MenuItem, NewOrder, Order, OrderBookApi, OrderStatus } from '../types';

const BASE = '/me/order-book';

type WireItem = { id: string; name: string; price_cents: number; ingredients: MenuItem['ingredients'] };
type WireOrder = {
  id: string;
  number: number;
  temp_number: string;
  day: string;
  lines: { item_id: string; name: string; price_cents: number; qty: number }[];
  total_cents: number;
  payment: Order['payment'];
  customer_name: string | null;
  status: OrderStatus;
  created_at: string;
  status_at: string;
};
type WireDay = {
  day: string;
  orders: number;
  cash_cents: number;
  digital_cents: number;
  later_cents: number;
  best_sellers: { name: string; qty: number }[];
  by_hour: number[];
};

const item = (m: WireItem): MenuItem => ({ id: m.id, name: m.name, priceCents: m.price_cents, ingredients: m.ingredients });

function order(o: WireOrder): Order {
  return {
    id: o.id,
    number: o.number,
    tempNumber: o.temp_number,
    day: o.day,
    lines: o.lines.map((l) => ({ itemId: l.item_id, name: l.name, priceCents: l.price_cents, qty: l.qty })),
    totalCents: o.total_cents,
    payment: o.payment,
    customerName: o.customer_name,
    status: o.status,
    createdAt: o.created_at,
    statusAt: o.status_at,
  };
}

const dayTotals = (d: WireDay): DayTotals => ({
  day: d.day,
  orders: d.orders,
  cashCents: d.cash_cents,
  digitalCents: d.digital_cents,
  laterCents: d.later_cents,
  bestSellers: d.best_sellers,
  byHour: d.by_hour,
});

const newOrder = (o: NewOrder) => ({
  id: o.id,
  day: o.day,
  temp_number: o.tempNumber,
  lines: o.lines.map((l) => ({ item_id: l.itemId, qty: l.qty })),
  payment: o.payment,
  customer_name: o.customerName,
  created_at: o.createdAt,
});

export const httpOrderBookApi: OrderBookApi = {
  async menu() {
    return (await api<{ items: WireItem[] }>('GET', `${BASE}/menu`, undefined, { auth: true })).items.map(item);
  },

  async saveMenu(items) {
    const body = { items: items.map((m) => ({ ...(m.id ? { id: m.id } : {}), name: m.name, price_cents: m.priceCents, ingredients: m.ingredients })) };
    return (await api<{ items: WireItem[] }>('PUT', `${BASE}/menu`, body, { auth: true })).items.map(item);
  },

  async orders(day) {
    return (await api<{ orders: WireOrder[] }>('GET', `${BASE}/orders?day=${encodeURIComponent(day)}`, undefined, { auth: true })).orders.map(order);
  },

  async create(o) {
    return order((await api<{ order: WireOrder }>('POST', `${BASE}/orders`, newOrder(o), { auth: true })).order);
  },

  async setStatus(id, status, at) {
    return order((await api<{ order: WireOrder }>('PATCH', `${BASE}/orders/${encodeURIComponent(id)}`, { status, at }, { auth: true })).order);
  },

  async week(endDay) {
    return (await api<{ days: WireDay[] }>('GET', `${BASE}/week?end=${encodeURIComponent(endDay)}`, undefined, { auth: true })).days.map(dayTotals);
  },
};
