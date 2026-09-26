/**
 * The Account tiles' order numbers, from the trader's own orders list:
 * how many are still open with a supplier, and how many were placed this
 * month (South Africa's calendar, like My record).
 */
import type { Order, OrderStatus } from '@/features/dashboard/informal-business/orders/types';
import { inMonth, thisMonth } from '@/features/dashboard/informal-business/record/lib/months';

/** With the supplier and not finished. An unpaid digital order isn't open: the supplier can't see it yet. */
const OPEN: readonly OrderStatus[] = ['placed', 'accepted', 'out_for_delivery', 'ready_for_collection'];

export type OrderCounts = { open: number; thisMonth: number };

export function orderCounts(orders: Order[], now: number = Date.now()): OrderCounts {
  const month = thisMonth(now);
  return {
    open: orders.filter((o) => OPEN.includes(o.status)).length,
    thisMonth: orders.filter((o) => inMonth(o.placedAt, month)).length,
  };
}
