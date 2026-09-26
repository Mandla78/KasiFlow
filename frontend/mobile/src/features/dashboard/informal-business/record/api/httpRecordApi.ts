/**
 * My record on the server (GET /me/record/summary). snake_case on the wire
 * is mapped here and nowhere else.
 */
import { api } from '@/shared/api/client';

import type { MoneyCount, RecordApi, RecordSeal, RecordSummary, SealCheck, SealItem } from '../types';

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

type WireCheck = {
  intact: boolean;
  signatures: { ed25519: string; ml_dsa_65: string };
  sealed_at: string;
  sealed: number;
  unchanged: number;
  changed: SealItem[];
  missing: SealItem[];
  added_since: number;
};

export function checkFromWire(c: WireCheck): SealCheck {
  return {
    intact: c.intact,
    signatures: { ed25519: c.signatures.ed25519, mlDsa65: c.signatures.ml_dsa_65 },
    sealedAt: c.sealed_at,
    sealed: c.sealed,
    unchanged: c.unchanged,
    changed: c.changed,
    missing: c.missing,
    addedSince: c.added_since,
  };
}

export const httpRecordApi: RecordApi = {
  async summary(month) {
    const q = month ? `?month=${encodeURIComponent(month)}` : '';
    return fromWire((await api<{ record: WireRecord }>('GET', `/me/record/summary${q}`, undefined, { auth: true })).record);
  },
  async seal() {
    // Kept exactly as it came: the server checks it byte for byte later.
    return (await api<{ seal: RecordSeal }>('POST', '/me/record/seal', undefined, { auth: true })).seal;
  },
  async check(seal) {
    return checkFromWire((await api<{ check: WireCheck }>('POST', '/me/record/check', { seal }, { auth: true })).check);
  },
};
