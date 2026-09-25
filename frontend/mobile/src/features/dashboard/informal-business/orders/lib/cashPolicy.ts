/**
 * Cash orders (docs/supplier/07). Digital payment is what we recommend: the
 * money is tracked and our commission is taken on the way. Cash is allowed,
 * with limits, because many traders still work in cash:
 *  - only if the supplier takes cash
 *  - only for verified businesses (stops fake orders reaching a supplier's system)
 *  - up to the supplier's own limit, and never over our cap of R5,000 per order
 *  - the supplier's system still has to accept it ("Waiting for the supplier")
 * The server enforces all of this; the app only explains it.
 */
import type { Cents } from '@/shared/lib/money';

export const PLATFORM_CASH_CAP_CENTS: Cents = 500000;

/** Most cash this supplier takes per order through us (null = no cash). */
export function cashLimitFor(s: { cash: boolean; cashLimitCents: Cents | null }): Cents | null {
  if (!s.cash) return null;
  return Math.min(s.cashLimitCents ?? PLATFORM_CASH_CAP_CENTS, PLATFORM_CASH_CAP_CENTS);
}
