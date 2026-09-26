/** The mock follows the server's rules, so the screen shows the same thing either way. */
import { expect, jest, test } from '@jest/globals';

import type { CreditEntry, CreditEntryDetail } from '@/features/dashboard/informal-business/credit-book/types';
import type { Job } from '@/features/dashboard/informal-business/jobs/types';
import type { Order } from '@/features/dashboard/informal-business/orders/types';

import { addMonths, thisMonth } from '../../lib/months';
import { mockRecordApi } from '../mockRecordApi';

const NOW = thisMonth();
const LAST = addMonths(NOW, -1);
const at = (month: string, day = 10) => `${month}-${String(day).padStart(2, '0')}T10:00:00Z`;

const order = (id: string, month: string, totalCents: number, o: Partial<Order>) =>
  ({ id, placedAt: at(month), totalCents, payment: 'cash', paymentStatus: 'cash_due', status: 'placed', ...o }) as Order;
const mockOrders: Order[] = [
  order('paid', NOW, 10000, { payment: 'in_app', paymentStatus: 'paid', status: 'accepted' }),
  order('both', NOW, 20000, { paymentStatus: 'confirmed_by_both', status: 'delivered' }),
  order('cash', NOW, 30000, {}),
  order('cancelled', NOW, 40000, { status: 'cancelled' }),
  order('unpaid', NOW, 50000, { payment: 'in_app', paymentStatus: 'unpaid', status: 'awaiting_payment' }),
  order('old', LAST, 60000, {}),
];

const entry = (id: string, givenOn: string, amountCents: number, status: CreditEntry['status']) => ({ id, givenOn, amountCents, status }) as CreditEntry;
const paid = entry('paid', `${NOW}-02`, 7000, 'paid');
const mockOpen: CreditEntry[] = [entry('open', `${NOW}-05`, 5000, 'open'), paid, entry('before', `${LAST}-28`, 9000, 'open')];
// A paid entry is in history too: it must count once.
const mockClosed: CreditEntry[] = [paid, entry('mistake', `${NOW}-03`, 8000, 'cancelled')];
const mockDetails: Record<string, CreditEntryDetail> = {
  open: { ...mockOpen[0]!, history: [{ id: 'r1', type: 'repayment', amountCents: 1000, on: `${NOW}-06`, recordedAt: '' }] },
  paid: { ...paid, history: [{ id: 'r2', type: 'repayment', amountCents: 7000, on: `${NOW}-04`, recordedAt: '' }] },
  before: { ...mockOpen[2]!, history: [{ id: 'r3', type: 'repayment', amountCents: 2000, on: `${LAST}-29`, recordedAt: '' }] },
  mistake: { ...mockClosed[1]!, history: [] },
};

const mockJobs = [
  {
    stages: [
      { status: 'confirmed', confirmedAt: at(NOW), clientAmountCents: 18000, signOffSentAt: at(NOW, 1) },
      { status: 'confirmed', confirmedAt: at(LAST), clientAmountCents: 99000, signOffSentAt: at(LAST, 1) },
      { status: 'amounts_dont_match', confirmedAt: null, clientAmountCents: 5000, signOffSentAt: at(NOW, 2) },
      { status: 'waiting', confirmedAt: null, clientAmountCents: null, signOffSentAt: at(NOW, 3) },
    ],
  },
] as unknown as Job[];

jest.mock('@/features/dashboard/informal-business/orders/api/ordersApi', () => ({ ordersApi: { list: async () => mockOrders } }));
jest.mock('@/features/dashboard/informal-business/credit-book/api/creditBookApi', () => ({
  creditBookApi: { list: async () => mockOpen, history: async () => mockClosed, get: async (id: string) => mockDetails[id] },
}));
jest.mock('@/features/dashboard/informal-business/jobs/api/jobsApi', () => ({ jobsApi: { list: async () => mockJobs } }));

test('stock bought is kept apart by what backs it, by order date', async () => {
  const r = await mockRecordApi.summary(NOW);
  expect(r.orders).toEqual({
    providerVerified: { cents: 10000, orders: 1 },
    confirmedByBoth: { cents: 20000, orders: 1 },
    notConfirmed: { cents: 30000, orders: 1 },
  });
  expect((await mockRecordApi.summary(LAST)).orders.notConfirmed).toEqual({ cents: 60000, orders: 1 });
});

test('credit by the day it was given and the day it was paid, each entry once', async () => {
  expect((await mockRecordApi.summary(NOW)).creditBook).toEqual({ givenCents: 5000 + 7000, paidBackCents: 1000 + 7000 });
  expect((await mockRecordApi.summary(LAST)).creditBook).toEqual({ givenCents: 9000, paidBackCents: 2000 });
});

test('jobs by the day the client confirmed', async () => {
  expect((await mockRecordApi.summary(NOW)).jobs).toEqual({ confirmedCents: 18000, confirmedStages: 1, amountsDontMatch: 1 });
});

test('no total, and no month outside the account', async () => {
  expect(JSON.stringify(await mockRecordApi.summary()).toLowerCase()).not.toContain('total');
  await expect(mockRecordApi.summary(addMonths(NOW, 1))).rejects.toThrow();
  const r = await mockRecordApi.summary();
  await expect(mockRecordApi.summary(addMonths(r.firstMonth, -1))).rejects.toThrow();
});
