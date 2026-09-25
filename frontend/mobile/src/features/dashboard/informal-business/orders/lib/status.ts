import type { Order, OrderStatus, PaymentStatus } from '../types';

export const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: 'Placed',
  accepted: 'Accepted',
  out_for_delivery: 'On its way',
  ready_for_collection: 'Ready to collect',
  delivered: 'Delivered',
  collected: 'Collected',
  rejected: 'Not accepted',
  cancelled: 'Cancelled',
};

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  unpaid: 'Not paid yet',
  paid: 'Paid in the app',
  cash_due: 'Cash on delivery',
  confirmed_by_both: 'Cash confirmed by both',
  disputed: "Amounts don't match",
  refunded: 'Refunded',
};

/** The steps this order goes through, for the timeline. */
export function stepsFor(o: Order): OrderStatus[] {
  if (o.status === 'cancelled' || o.status === 'rejected') return ['placed', o.status];
  return o.fulfilment === 'collect'
    ? ['placed', 'accepted', 'ready_for_collection', 'collected']
    : ['placed', 'accepted', 'out_for_delivery', 'delivered'];
}

export function isActive(o: Order): boolean {
  return !['delivered', 'collected', 'rejected', 'cancelled'].includes(o.status);
}

export function when(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}`;
}
