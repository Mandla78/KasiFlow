/** What the seal card says: plain words, South African time, never "proof". */
import { expect, test } from '@jest/globals';

import type { RecordSeal, SealCheck } from '../../types';
import { checkView, saTime, sealedLine, signatureChips } from '../seal';

const SEAL = {
  v: 1,
  alg: ['Ed25519', 'ML-DSA-65'],
  business: 'b',
  sealed_at: '2026-09-26T21:10:03+00:00',
  count: 42,
  root: '0'.repeat(64),
  leaves: [],
  sig: { ed25519: 'x', ml_dsa_65: 'y' },
  key_ids: { ed25519: '0'.repeat(16), ml_dsa_65: '0'.repeat(16) },
} as RecordSeal;

const CHECK: SealCheck = {
  intact: true,
  signatures: { ed25519: 'valid', mlDsa65: 'valid' },
  sealedAt: SEAL.sealed_at,
  sealed: 42,
  unchanged: 42,
  changed: [],
  missing: [],
  addedSince: 3,
};

test('times are South African', () => {
  expect(saTime('2026-09-26T21:10:03+00:00')).toBe('26 Sep, 23:10');
  expect(saTime('2026-09-30T22:30:00+00:00')).toBe('1 Oct, 00:30');
  expect(sealedLine(SEAL)).toBe('Sealed 26 Sep, 23:10 · 42 records');
});

test('the post-quantum signature says so', () => {
  expect(signatureChips(SEAL.alg)).toEqual(['Ed25519', 'ML-DSA-65 · post-quantum']);
  expect(signatureChips(['Ed25519'])).toEqual(['Ed25519']);
});

test('nothing changed: how many, when, and what was added since', () => {
  expect(checkView(CHECK)).toEqual({
    tone: 'ok',
    title: 'Nothing you sealed has changed',
    lines: ['42 records exactly as sealed on 26 Sep, 23:10', '3 records added since', 'Both signatures check out, including the post-quantum one'],
  });
});

test('a change or a gap names the record and its day', () => {
  const v = checkView({
    ...CHECK,
    intact: false,
    unchanged: 40,
    changed: [{ kind: 'Repayment', id: 'r1', on: '2026-09-26' }],
    missing: [{ kind: 'Credit given', id: 'e1', on: null }],
  });
  expect(v).toEqual({ tone: 'warn', title: '2 records changed since you sealed', lines: ['Repayment · 26 Sep · changed', 'Credit given · gone'] });
});

test('never the word proof in what a check says', () => {
  const text = JSON.stringify([checkView(CHECK), checkView({ ...CHECK, intact: false, changed: [{ kind: 'Repayment', id: 'r', on: null }] })]);
  expect(text.toLowerCase()).not.toContain('proof');
});
