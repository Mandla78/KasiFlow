import { describe, expect, it } from '@jest/globals';

import { Job, Stage } from '../../types';
import { confirmedCents, currentStage, decide, difference, signOffMessage, statusLabel, stagesTotal } from '../stages';

const stage = (name: string, amountCents: number, extra: Partial<Stage> = {}): Stage => ({
  id: name.toLowerCase(),
  name,
  amountCents,
  status: 'not_started',
  photo: null,
  builderAmountCents: null,
  clientAmountCents: null,
  signOffSentAt: null,
  confirmedAt: null,
  clientNote: null,
  ...extra,
});

const job: Job = {
  id: 'j1',
  title: 'Room extension',
  clientName: 'Mokoena family',
  clientPhone: '0821234567',
  place: 'Tembisa',
  totalCents: 3_800_000,
  status: 'active',
  createdAt: '2026-09-25T08:00:00Z',
  stages: [
    stage('Deposit', 500_000, { status: 'confirmed', builderAmountCents: 500_000, clientAmountCents: 500_000 }),
    stage('Walls', 1_200_000, { status: 'waiting', builderAmountCents: 1_200_000 }),
    stage('Roof', 1_200_000),
    stage('Final', 900_000),
  ],
};

describe('stages add up to the total', () => {
  it('sums the stages', () => expect(stagesTotal(job.stages)).toBe(3_800_000));
  it('says when they add up', () => expect(difference(3_800_000, 3_800_000)).toEqual({ text: 'The stages add up to the total.', ok: true }));
  it('says what is left to share out', () => expect(difference(3_800_000, 3_500_000)).toEqual({ text: 'R3,000 still to share out between the stages.', ok: false }));
  it('says when the stages are too much', () => expect(difference(3_800_000, 4_000_000)).toEqual({ text: 'The stages are R2,000 more than the total.', ok: false }));
});

describe('paid and confirmed', () => {
  it('counts only stages confirmed by both', () => expect(confirmedCents(job)).toBe(500_000));
  it('works on the first unconfirmed stage', () => expect(currentStage(job)?.name).toBe('Walls'));
  it('has nothing left when all are confirmed', () => {
    const done = { ...job, stages: job.stages.map((s) => ({ ...s, status: 'confirmed' as const })) };
    expect(currentStage(done)).toBeNull();
  });
});

describe('the match rule', () => {
  it('the same amount is confirmed by both', () => expect(decide(1_200_000, { kind: 'done', amountCents: 1_200_000 })).toBe('confirmed'));
  it('a different amount is a dispute, never silently fixed', () => expect(decide(1_200_000, { kind: 'done', amountCents: 1_000_000 })).toBe('amounts_dont_match'));
  it('"not yet" goes back to the builder', () => expect(decide(1_200_000, { kind: 'not_yet', note: 'Windows' })).toBe('photo_taken'));
  it('zero cash on both sides still matches', () => expect(decide(0, { kind: 'done', amountCents: 0 })).toBe('confirmed'));
});

describe('words', () => {
  it.each([
    [stage('Roof', 1), 'Not started', 'muted'],
    [stage('Walls', 1, { status: 'photo_taken', photo: { uri: 'x', takenAt: 'y' } }), 'Photo taken · send sign-off', 'marigold'],
    [stage('Walls', 1, { status: 'photo_taken', clientNote: 'Windows' }), 'Client said not yet', 'marigold'],
    [stage('Walls', 1, { status: 'waiting', photo: { uri: 'x', takenAt: 'y' } }), 'Photo taken · waiting for client', 'marigold'],
    [stage('Deposit', 1, { status: 'waiting' }), 'Waiting for client', 'marigold'],
    [stage('Deposit', 1, { status: 'confirmed' }), 'Confirmed by both', 'jade'],
    [stage('Walls', 1, { status: 'amounts_dont_match' }), "Amounts don't match", 'garnet'],
  ])('%#: status label', (s, text, tone) => expect(statusLabel(s)).toEqual({ text, tone }));

  it('the sign-off message carries the link and no amount', () => {
    const text = signOffMessage(job, job.stages[1], 'Bongani Builds', 'https://akayza.test/sign-off?ticket=abc');
    expect(text).toBe(
      'Hi Mokoena family, Bongani Builds asks you to sign off the Walls stage of the room extension. Please confirm here, no app needed: https://akayza.test/sign-off?ticket=abc Thank you!',
    );
    expect(text).not.toMatch(/R\d/);
  });
});
