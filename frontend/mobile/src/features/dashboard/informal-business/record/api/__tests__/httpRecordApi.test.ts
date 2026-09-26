/** My record over the wire: one month, signed in, snake_case mapped once. */
import { beforeEach, expect, jest, test } from '@jest/globals';

import { httpRecordApi } from '../httpRecordApi';

const mockCalls: { method: string; path: string; opts: unknown }[] = [];
let mockReply: () => unknown = () => ({});

jest.mock('@/shared/api/client', () => ({
  api: async (method: string, path: string, _body: unknown, opts: unknown) => {
    mockCalls.push({ method, path, opts });
    return mockReply();
  },
}));

const WIRE = {
  month: '2026-09',
  first_month: '2026-06',
  orders: {
    provider_verified: { cents: 123450, orders: 2 },
    confirmed_by_both: { cents: 50000, orders: 1 },
    not_confirmed: { cents: 35000, orders: 3 },
  },
  credit_book: { given_cents: 42000, paid_back_cents: 15000 },
  jobs: null,
};

beforeEach(() => {
  mockCalls.length = 0;
  mockReply = () => ({ record: WIRE });
});

test('asks for one month, signed in', async () => {
  await httpRecordApi.summary('2026-08');
  expect(mockCalls).toEqual([{ method: 'GET', path: '/me/record/summary?month=2026-08', opts: { auth: true } }]);
});

test('no month asks for this month', async () => {
  await httpRecordApi.summary();
  expect(mockCalls[0]!.path).toBe('/me/record/summary');
});

test('the three blocks come back apart, and a switched-off tool stays null', async () => {
  expect(await httpRecordApi.summary('2026-09')).toEqual({
    month: '2026-09',
    firstMonth: '2026-06',
    orders: {
      providerVerified: { cents: 123450, orders: 2 },
      confirmedByBoth: { cents: 50000, orders: 1 },
      notConfirmed: { cents: 35000, orders: 3 },
    },
    creditBook: { givenCents: 42000, paidBackCents: 15000 },
    jobs: null,
  });
});

test('sealing posts nothing and keeps the seal exactly as it came', async () => {
  const seal = { v: 1, alg: ['Ed25519', 'ML-DSA-65'], business: 'b', sealed_at: 't', count: 0, root: 'r', leaves: [], sig: { ed25519: 's', ml_dsa_65: 'q' }, key_ids: { ed25519: 'k', ml_dsa_65: 'm' } };
  mockReply = () => ({ seal });
  expect(await httpRecordApi.seal()).toEqual(seal);
  expect(mockCalls[0]).toEqual({ method: 'POST', path: '/me/record/seal', opts: { auth: true } });
});

test('checking sends the seal back untouched and maps the answer', async () => {
  mockReply = () => ({
    check: {
      intact: false,
      signatures: { ed25519: 'valid', ml_dsa_65: 'valid' },
      sealed_at: 't',
      sealed: 3,
      unchanged: 2,
      changed: [{ kind: 'Repayment', id: 'r', on: '2026-09-26' }],
      missing: [],
      added_since: 1,
    },
  });
  const seal = { v: 1 } as never;
  const c = await httpRecordApi.check(seal);
  expect(c).toEqual({
    intact: false,
    signatures: { ed25519: 'valid', mlDsa65: 'valid' },
    sealedAt: 't',
    sealed: 3,
    unchanged: 2,
    changed: [{ kind: 'Repayment', id: 'r', on: '2026-09-26' }],
    missing: [],
    addedSince: 1,
  });
  expect(mockCalls[0]!.path).toBe('/me/record/check');
});
