/** Credit writes carry the Idempotency-Key they're given, so a retry lands once. */
import { beforeEach, expect, jest, test } from '@jest/globals';

import { httpCreditBookApi } from '../httpCreditBookApi';

const mockCalls: { method: string; path: string; opts: { headers?: Record<string, string> } }[] = [];

jest.mock('@/shared/api/client', () => ({
  ApiError: class extends Error {},
  api: async (method: string, path: string, _body: unknown, opts: { headers?: Record<string, string> }) => {
    mockCalls.push({ method, path, opts });
    return {
      entry: {
        id: 'e1', customer: { id: 'c1', name: 'Thandi', phone: null }, amount_cents: 10000, paid_cents: 0, outstanding_cents: 10000,
        description: '', given_on: '2026-09-26', due_on: '2026-10-03', status: 'open', created_at: 't', binned_at: null, history: [],
      },
    };
  },
}));

beforeEach(() => {
  mockCalls.length = 0;
});

test('a credit sale and a repayment send their key', async () => {
  await httpCreditBookApi.addSale({ customer: { name: 'Thandi', phone: null }, amountCents: 10000, description: '', dueOn: '2026-10-03' }, 'sale-key');
  await httpCreditBookApi.recordRepayment('e1', { amountCents: 3000, paidOn: '2026-09-26' }, 'pay-key');
  expect(mockCalls.map((c) => [c.path, c.opts.headers])).toEqual([
    ['/me/credit-book/entries', { 'Idempotency-Key': 'sale-key' }],
    ['/me/credit-book/entries/e1/payments', { 'Idempotency-Key': 'pay-key' }],
  ]);
});

test('without a key, no header', async () => {
  await httpCreditBookApi.recordRepayment('e1', { amountCents: 3000, paidOn: '2026-09-26' });
  expect(mockCalls[0]!.opts.headers).toBeUndefined();
});
