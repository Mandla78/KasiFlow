/**
 * My record on the server (GET /me/record/summary). snake_case on the wire
 * is mapped here and nowhere else.
 */
import { api } from '@/shared/api/client';

import type { MoneyCount, RecordApi, RecordSummary } from '../types';

type WireMoney = { cents: number; orders: number };
type WireRecord = {
  month: string;
  first_month: string;
  orders: { provider_verified: WireMoney; confirmed_by_both: WireMoney; not_confirmed: WireMoney };
  credit_book: { given_cents: number; paid_back_cents: number } | null;
  jobs: { confirmed_cents: number; confirmed_stages: number; amounts_dont_match: number } | null;
};

const money = (m: WireMoney): MoneyCount => ({ cents: m.cents, orders: m.orders });

export function fromWire(r: WireRecord): RecordSummary {
  return {
    month: r.month,
    firstMonth: r.first_month,
    orders: { providerVerified: money(r.orders.provider_verified), confirmedByBoth: money(r.orders.confirmed_by_both), notConfirmed: money(r.orders.not_confirmed) },
    creditBook: r.credit_book ? { givenCents: r.credit_book.given_cents, paidBackCents: r.credit_book.paid_back_cents } : null,
    jobs: r.jobs ? { confirmedCents: r.jobs.confirmed_cents, confirmedStages: r.jobs.confirmed_stages, amountsDontMatch: r.jobs.amounts_dont_match } : null,
  };
}

export const httpRecordApi: RecordApi = {
  async summary(month) {
    const q = month ? `?month=${encodeURIComponent(month)}` : '';
    return fromWire((await api<{ record: WireRecord }>('GET', `/me/record/summary${q}`, undefined, { auth: true })).record);
  },
};
