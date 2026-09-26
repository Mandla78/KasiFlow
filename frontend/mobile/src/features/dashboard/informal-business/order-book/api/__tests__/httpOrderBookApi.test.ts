/**
 * The wire <-> app mapping for the order book, fed the exact shapes the
 * server returns (backend order_book routes), and the requests the app sends.
 */
import { beforeEach, expect, jest, test } from '@jest/globals';

import { httpOrderBookApi } from '../httpOrderBookApi';

type Call = { method: string; path: string; body?: unknown; opts?: { auth?: boolean } };
const mockCalls: Call[] = [];
let mockReplies: unknown[] = [];
jest.mock('@/shared/api/client', () => ({
  api: async (method: string, path: string, body?: unknown, opts?: Call['opts']) => {
    mockCalls.push({ method, path, body, opts });
    return mockReplies.shift();
  },
}));

beforeEach(() => {
  mockCalls.length = 0;
  mockReplies = [];
});

const KEY = '6f1c2a4e-9b0d-4c3e-8a1f-2b3c4d5e6f70';
const ORDER = {
  id: KEY,
  number: 14,
  temp_number: 'A3',
  day: '2026-09-26',
  lines: [{ item_id: 'i1', name: 'Russian kota', price_cents: 4500, qty: 2 }],
  total_cents: 9000,
  payment: 'cash',
  customer_name: 'Thabo',
  status: 'new',
  created_at: '2026-09-26T10:00:00+00:00',
  status_at: '2026-09-26T10:00:00+00:00',
};

test('an order goes out in snake_case with the phone key, and comes back numbered', async () => {
  mockReplies = [{ order: ORDER }];
  const o = await httpOrderBookApi.create({
    id: KEY,
    day: '2026-09-26',
    tempNumber: 'A3',
    lines: [{ itemId: 'i1', qty: 2 }],
    payment: 'cash',
    customerName: 'Thabo',
    createdAt: '2026-09-26T10:00:00.000Z',
  });
  expect(mockCalls[0]).toEqual({
    method: 'POST',
    path: '/me/order-book/orders',
    body: { id: KEY, day: '2026-09-26', temp_number: 'A3', lines: [{ item_id: 'i1', qty: 2 }], payment: 'cash', customer_name: 'Thabo', created_at: '2026-09-26T10:00:00.000Z' },
    opts: { auth: true },
  });
  expect(o).toEqual({
    id: KEY,
    number: 14,
    tempNumber: 'A3',
    day: '2026-09-26',
    lines: [{ itemId: 'i1', name: 'Russian kota', priceCents: 4500, qty: 2 }],
    totalCents: 9000,
    payment: 'cash',
    customerName: 'Thabo',
    status: 'new',
    createdAt: '2026-09-26T10:00:00+00:00',
    statusAt: '2026-09-26T10:00:00+00:00',
  });
});

test('a queue step is addressed by the phone key', async () => {
  mockReplies = [{ order: { ...ORDER, status: 'preparing' } }];
  const o = await httpOrderBookApi.setStatus(KEY, 'preparing', '2026-09-26T10:05:00.000Z');
  expect(mockCalls[0]).toMatchObject({ method: 'PATCH', path: `/me/order-book/orders/${KEY}`, body: { status: 'preparing', at: '2026-09-26T10:05:00.000Z' } });
  expect(o.status).toBe('preparing');
});

test('the menu: new items go without an id, kept ones with theirs', async () => {
  mockReplies = [{ items: [{ id: 'i1', name: 'Russian kota', price_cents: 4500, ingredients: ['quarter_loaf'] }, { id: 'i2', name: 'Cold drink', price_cents: 1200, ingredients: ['cold_drink'] }] }];
  const menu = await httpOrderBookApi.saveMenu([
    { id: 'i1', name: 'Russian kota', priceCents: 4500, ingredients: ['quarter_loaf'] },
    { name: 'Cold drink', priceCents: 1200, ingredients: ['cold_drink'] },
  ]);
  expect(mockCalls[0]).toMatchObject({
    method: 'PUT',
    path: '/me/order-book/menu',
    body: {
      items: [
        { id: 'i1', name: 'Russian kota', price_cents: 4500, ingredients: ['quarter_loaf'] },
        { name: 'Cold drink', price_cents: 1200, ingredients: ['cold_drink'] },
      ],
    },
  });
  expect(menu[1]).toEqual({ id: 'i2', name: 'Cold drink', priceCents: 1200, ingredients: ['cold_drink'] });
});

test('a day and the week', async () => {
  mockReplies = [
    { orders: [ORDER] },
    { days: [{ day: '2026-09-26', orders: 3, cash_cents: 9000, digital_cents: 8100, later_cents: 2500, best_sellers: [{ name: 'Russian kota', qty: 3 }], by_hour: Array(24).fill(0) }] },
  ];
  expect((await httpOrderBookApi.orders('2026-09-26'))[0]!.number).toBe(14);
  expect(mockCalls[0]!.path).toBe('/me/order-book/orders?day=2026-09-26');
  const [d] = await httpOrderBookApi.week('2026-09-26');
  expect(mockCalls[1]!.path).toBe('/me/order-book/week?end=2026-09-26');
  expect(d).toMatchObject({ orders: 3, cashCents: 9000, digitalCents: 8100, laterCents: 2500, bestSellers: [{ name: 'Russian kota', qty: 3 }] });
});
