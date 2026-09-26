/**
 * What backs an order's payment, in words and colours. The server decides
 * (order.evidence); evidenceOf() is the same rule for the mock.
 *
 *   provider_verified   paid digitally: PayFast, a regulated provider,
 *                       confirmed it -- independent proof
 *   confirmed_by_both   cash both sides confirmed in the app -- what they
 *                       said, not checked by any bank or provider
 *   not_confirmed       cash still to pay -- proof of nothing yet
 *   none                no payment (unpaid, cancelled, refunded)
 *
 * NEVER add these together into one "money in" figure.
 */
import type { Evidence, Order } from '../types';

export const EVIDENCE_LABEL: Record<Evidence, string> = {
  provider_verified: 'Verified by PayFast',
  confirmed_by_both: 'Cash, confirmed by both',
  not_confirmed: 'Cash, not confirmed yet',
  none: 'No payment yet',
};

export const EVIDENCE_TONE: Record<Evidence, 'jade' | 'info' | 'marigold' | 'garnet'> = {
  provider_verified: 'jade',
  confirmed_by_both: 'info',
  not_confirmed: 'marigold',
  none: 'marigold',
};

export function evidenceOf(o: Order): Evidence {
  if (o.evidence) return o.evidence;
  if (o.payment === 'in_app') return o.paymentStatus === 'paid' ? 'provider_verified' : 'none';
  if (o.paymentStatus === 'confirmed_by_both') return 'confirmed_by_both';
  return ['cancelled', 'rejected', 'expired'].includes(o.status) ? 'none' : 'not_confirmed';
}
