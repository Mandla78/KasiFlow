/**
 * The Account numbers that can't come from the trader's own tools yet:
 * orders and stock (Mandla's side) and My record (not built). Shown with a
 * "sample" mark until they're real. Credit book and jobs lines are live.
 * All money in cents.
 */
import { Cents } from '@/shared/lib/money';

export const accountSample = {
  stockBought: 987000 as Cents,
  stockOnItsWay: 1,
  ordersThisMonth: 12,
  recordConfirmed: 38,
  recordTotal: 41,
};
