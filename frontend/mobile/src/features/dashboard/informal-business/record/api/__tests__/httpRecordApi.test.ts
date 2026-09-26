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
