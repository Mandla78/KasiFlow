/**
 * Cash orders (docs/supplier/12_POLICIES.txt). Digital payment is what we
 * recommend: it's tracked, and nothing reaches the supplier until it's
 * paid. Cash is there because many traders still work in cash:
 *  - offered whenever the supplier takes cash, to every trader
 *  - up to R1,000 per order (or the supplier's own limit, if lower)
 *  - at most 2 cash orders waiting at a time (placed, not yet delivered)
 *  - the supplier's system accepts the order first
 * The server enforces all of this; the app explains it.
 */
import type { Cents } from '@/shared/lib/money';

export const CASH_LIMIT_CENTS: Cents = 100000;
export const MAX_OPEN_CASH_ORDERS = 2;

/** Most cash this supplier takes per order through us (null = no cash). */
export function cashLimitFor(s: { cash: boolean; cashLimitCents: Cents | null }): Cents | null {
  if (!s.cash) return null;
  return Math.min(s.cashLimitCents ?? CASH_LIMIT_CENTS, CASH_LIMIT_CENTS);
}

/** What a trader sees under "How cash works". */
export const CASH_RULES = [
  'Cash is up to R1,000 per order. For bigger orders, pay digitally.',
  'You can have 2 cash orders waiting at a time. Once one is delivered or collected, you can place another.',
  'The supplier accepts a cash order before it goes out.',
  'When the cash is handed over, you and the supplier both confirm the amount.',
];
