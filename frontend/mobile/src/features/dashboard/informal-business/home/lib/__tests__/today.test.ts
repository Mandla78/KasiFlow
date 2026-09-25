import { describe, expect, it } from '@jest/globals';

import { CreditEntry } from '@/features/dashboard/informal-business/credit-book/types';
import { Job, Stage } from '@/features/dashboard/informal-business/jobs/types';

import { creditToday, jobsToday } from '../today';

const T = '2026-09-25';

const entry = (id: string, name: string, dueOn: string, extra: Partial<CreditEntry> = {}): CreditEntry => ({
  id,
  customer: { id: `c-${id}`, name, phone: null },
  amountCents: 4800,
  paidCents: 0,
  outstandingCents: 4800,
  description: 'Bread, milk',
  givenOn: '2026-09-01',
  dueOn,
  status: 'open',
  createdAt: `${T}T08:00:00Z`,
  ...extra,
});

const stage = (id: string, name: string, status: Stage['status']): Stage => ({
  id,
  name,
  amountCents: 1_200_000,
  status,
  photo: null,
  builderAmountCents: null,
  clientAmountCents: null,
  signOffSentAt: null,
  confirmedAt: null,
  clientNote: null,
});

const job = (stages: Stage[], extra: Partial<Job> = {}): Job => ({
  id: 'j1',
  title: 'Room extension',
  clientName: 'Mokoena',
  clientPhone: '0821234567',
  place: '',
  totalCents: 3_600_000,
  status: 'active',
  createdAt: `${T}T08:00:00Z`,
  stages,
  ...extra,
});

describe('credit book: who pays today', () => {
  it('lists late ones first (latest first), then due today, and nothing that is not due or not open', () => {
    const items = creditToday(
      [
        entry('a', 'Thandi', T),
        entry('b', 'Lerato', '2026-09-22'),
        entry('c', 'Sipho', '2026-09-28'),
        entry('d', 'Mpho', '2026-09-24'),
        entry('e', 'Zodwa', '2026-09-20', { status: 'paid' }),
      ],
      T,
    );
    expect(items.map((i) => i.title)).toEqual(['Lerato is 3 days late', 'Mpho is 1 day late', 'Thandi pays today']);
    expect(items[2]).toMatchObject({ subtitle: 'Credit book · Bread, milk', amount: 4800, tint: 'info' });
    expect(items[0].tint).toBe('marigold');
  });

  it('shows at most three', () => {
    const many = ['a', 'b', 'c', 'd', 'e'].map((id) => entry(id, id, T));
    expect(creditToday(many, T)).toHaveLength(3);
  });
});

describe('jobs: which stages need the builder', () => {
  it('puts disputes first, then photos to send, then stages waiting on the client', () => {
    const items = jobsToday([job([stage('s1', 'Walls', 'waiting'), stage('s2', 'Roof', 'photo_taken'), stage('s3', 'Final', 'amounts_dont_match'), stage('s4', 'Deposit', 'confirmed')])]);
    expect(items.map((i) => i.subtitle)).toEqual(["Final · amounts don't match", 'Roof · photo taken', 'Walls · waiting for client']);
    expect(items[0].tag?.label).toBe('Talk to client');
    expect(items[2].amount).toBe(1_200_000);
  });

  it('ignores done jobs and untouched stages', () => {
    expect(jobsToday([job([stage('s1', 'Walls', 'waiting')], { status: 'done' }), job([stage('s2', 'Roof', 'not_started')])])).toEqual([]);
  });
});
