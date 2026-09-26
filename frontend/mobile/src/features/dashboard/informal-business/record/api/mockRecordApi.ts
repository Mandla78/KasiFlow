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
import type { RecordApi, RecordSeal, RecordSummary } from '../types';

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

/** How many records the sample tools hold (credit given, repayments, confirmed stages): what a seal would cover. */
async function sampleRecords(): Promise<number> {
  const [open, closed, jobs] = await Promise.all([
    creditBookApi.list().catch(() => []),
    creditBookApi.history('').catch(() => []),
    jobsApi.list().catch(() => []),
  ]);
  const entries = [...new Map([...open, ...closed].map((e) => [e.id, e])).values()];
  const details = await Promise.all(entries.map((e) => creditBookApi.get(e.id).catch(() => null)));
  const repayments = details.reduce((n, d) => n + (d?.history ?? []).filter((h) => h.type === 'repayment').length, 0);
  const confirmed = jobs.flatMap((j) => j.stages).filter((s) => s.status === 'confirmed').length;
  return entries.length + repayments + confirmed;
}

export const mockRecordApi: RecordApi = {
  async summary(month) {
    const m = month ?? thisMonth();
    if (m > thisMonth() || m < addMonths(thisMonth(), -MONTHS_BACK)) throw new Error("That month can't be shown.");
    return summarise(m);
  },
  // Sample data: nothing is signed or fingerprinted here, and the seal says so (mock: true).
  async seal() {
    const count = await sampleRecords();
    const seal: RecordSeal = {
      v: 1,
      alg: ['Ed25519', 'ML-DSA-65'],
      business: 'sample',
      sealed_at: new Date().toISOString().slice(0, 19) + '+00:00',
      count,
      root: '0'.repeat(64),
      leaves: [],
      sig: { ed25519: 'sample', ml_dsa_65: 'sample' },
      key_ids: { ed25519: '0'.repeat(16), ml_dsa_65: '0'.repeat(16) },
      mock: true,
    };
    return seal;
  },
  async check(seal) {
    const now = await sampleRecords();
    return {
      intact: true,
      signatures: { ed25519: 'valid', mlDsa65: 'valid' },
      sealedAt: seal.sealed_at,
      sealed: seal.count,
      unchanged: seal.count,
      changed: [],
      missing: [],
      addedSince: Math.max(0, now - seal.count),
    };
  },
};
