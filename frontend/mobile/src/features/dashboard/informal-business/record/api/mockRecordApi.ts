/**
 * MOCK My record: the server's rules on the sample tools, so the screen
 * works with EXPO_PUBLIC_USE_MOCK_API=true. Orders by order date, kept
 * apart by what backs them (evidenceOf, like the server's
 * payment_evidence); credit given by the day it was given and paid back by
 * the day it was paid (binned entries left out); jobs by the day the
 * client confirmed. No total. Whether a tool is on is the screen's to say
 * (the session's profile); the server answers null for it.
 */
import { creditBookApi } from '@/features/dashboard/informal-business/credit-book/api/creditBookApi';
import { jobsApi } from '@/features/dashboard/informal-business/jobs/api/jobsApi';
import { ordersApi } from '@/features/dashboard/informal-business/orders/api/ordersApi';
import { evidenceOf } from '@/features/dashboard/informal-business/orders/lib/evidence';

import { addMonths, inMonth, thisMonth } from '../lib/months';
import type { RecordApi, RecordSummary } from '../types';

/** The sample account is a few months old. */
const MONTHS_BACK = 5;

export async function summarise(month: string): Promise<RecordSummary> {
  const [orders, open, closed, jobs] = await Promise.all([
    ordersApi.list().catch(() => []),
    creditBookApi.list().catch(() => []),
    creditBookApi.history('').catch(() => []),
    jobsApi.list().catch(() => []),
  ]);

  const o = { providerVerified: { cents: 0, orders: 0 }, confirmedByBoth: { cents: 0, orders: 0 }, notConfirmed: { cents: 0, orders: 0 } };
  for (const order of orders) {
    if (!inMonth(order.placedAt, month)) continue;
    const e = evidenceOf(order);
    const block = e === 'provider_verified' ? o.providerVerified : e === 'confirmed_by_both' ? o.confirmedByBoth : e === 'not_confirmed' ? o.notConfirmed : null;
    if (block) {
      block.cents += order.totalCents;
      block.orders += 1;
    }
  }

  // A paid entry is in both lists; count it once.
  const entries = [...new Map([...open, ...closed].map((e) => [e.id, e])).values()];
  const given = entries.filter((e) => e.status !== 'cancelled' && inMonth(e.givenOn, month)).reduce((s, e) => s + e.amountCents, 0);
  const details = await Promise.all(entries.map((e) => creditBookApi.get(e.id).catch(() => null)));
  const paidBack = details.reduce((s, d) => s + (d?.history ?? []).reduce((t, h) => t + (h.type === 'repayment' && inMonth(h.on, month) ? h.amountCents : 0), 0), 0);

  const stages = jobs.flatMap((j) => j.stages);
  const confirmed = stages.filter((s) => s.status === 'confirmed' && s.confirmedAt && inMonth(s.confirmedAt, month));
  const mismatched = stages.filter((s) => s.status === 'amounts_dont_match' && s.signOffSentAt && inMonth(s.signOffSentAt, month));

  return {
    month,
    firstMonth: addMonths(thisMonth(), -MONTHS_BACK),
    orders: o,
    creditBook: { givenCents: given, paidBackCents: paidBack },
    jobs: { confirmedCents: confirmed.reduce((s, x) => s + (x.clientAmountCents ?? 0), 0), confirmedStages: confirmed.length, amountsDontMatch: mismatched.length },
  };
}

export const mockRecordApi: RecordApi = {
  async summary(month) {
    const m = month ?? thisMonth();
    if (m > thisMonth() || m < addMonths(thisMonth(), -MONTHS_BACK)) throw new Error("That month can't be shown.");
    return summarise(m);
  },
};
