import { expect, test } from '@jest/globals';

import type { Order, OrderStatus } from '@/features/dashboard/informal-business/orders/types';

import { orderCounts } from '../orderCounts';

const NOW = Date.parse('2026-09-26T10:00:00Z');
const order = (status: OrderStatus, placedAt = '2026-09-20T10:00:00Z') => ({ status, placedAt }) as Order;

test('open means with the supplier and not finished', () => {
  const all: OrderStatus[] = ['awaiting_payment', 'placed', 'accepted', 'out_for_delivery', 'ready_for_collection', 'delivered', 'collected', 'rejected', 'cancelled', 'expired'];
  expect(orderCounts(all.map((s) => order(s)), NOW).open).toBe(4);
});

test("this month is every order placed in South Africa's month", () => {
  const list = [
    order('placed', '2026-08-31T22:30:00Z'), // 00:30 on 1 September in SA
    order('delivered', '2026-08-31T21:30:00Z'), // still August in SA
    order('cancelled', '2026-09-26T08:00:00Z'),
  ];
  expect(orderCounts(list, NOW)).toEqual({ open: 1, thisMonth: 2 });
});

test('no orders, no numbers made up', () => {
  expect(orderCounts([], NOW)).toEqual({ open: 0, thisMonth: 0 });
});
