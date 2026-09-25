import type { Order, OrderStatus, PaymentStatus } from '../types';

/** Where the order is now (the tag on an order). */
export const STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_payment: 'Waiting for payment',
  placed: 'Waiting for the supplier',
  accepted: 'Accepted',
  out_for_delivery: 'On its way',
  ready_for_collection: 'Ready to collect',
  delivered: 'Delivered',
  collected: 'Collected',
  rejected: 'Not accepted',
  cancelled: 'Cancelled',
  expired: 'Lapsed (not paid)',
};

/** A step on the timeline, once it has happened. */
export const STEP_LABEL: Record<OrderStatus, string> = {
  ...STATUS_LABEL,
  placed: 'Sent to the supplier',
  accepted: 'Accepted by the supplier',
};

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  unpaid: 'Not paid yet',
  paid: 'Paid',
  cash_due: 'Cash to pay',
  confirmed_by_both: 'Cash confirmed by both',
  disputed: "Amounts don't match",
  refunded: 'Refunded',
};

/** The steps this order goes through, for the timeline. */
export function stepsFor(o: Order): OrderStatus[] {
  if (o.status === 'cancelled' || o.status === 'rejected' || o.status === 'expired') return ['placed', o.status];
  return o.fulfilment === 'collect'
    ? ['placed', 'accepted', 'ready_for_collection', 'collected']
    : ['placed', 'accepted', 'out_for_delivery', 'delivered'];
}

/** Ended without a sale: cancelled, not accepted, or lapsed unpaid. */
export function isStopped(o: Order): boolean {
  return o.status === 'cancelled' || o.status === 'rejected' || o.status === 'expired';
}

/** Only a cash order, and only until the supplier accepts it. A digital
 *  order is never cancelled by the trader (docs/supplier/12, section 2);
 *  an unpaid one lapses on its own. */
export function canCancel(o: Order): boolean {
  return o.payment === 'cash' && o.status === 'placed';
}

export function isActive(o: Order): boolean {
  return !['delivered', 'collected', 'rejected', 'cancelled', 'expired'].includes(o.status);
}

export function when(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}`;
}
