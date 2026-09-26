/**
 * What the seal card says, worked out from a seal and a check so the
 * wording can be tested without rendering. Plain words: "sealed", "changed
 * since", never "proof" -- a seal shows records haven't changed, not that
 * they're true (CLAUDE.md, honest proof).
 */
import type { RecordSeal, SealCheck, SealItem } from '../types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "26 Sep, 23:10" in South African time (UTC+2). */
export function saTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const d = new Date(t + 2 * 3_600_000);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${hh}:${mm}`;
}

const records = (n: number) => (n === 1 ? '1 record' : `${n} records`);

export function sealedLine(seal: RecordSeal): string {
  return `Sealed ${saTime(seal.sealed_at)} · ${records(seal.count)}`;
}

/** The signatures a seal carries, as chips: the post-quantum one says so. */
export function signatureChips(alg: string[]): string[] {
  return alg.map((a) => (a === 'ML-DSA-65' ? 'ML-DSA-65 · post-quantum' : a));
}

const day = (on: string | null) => (on ? saTime(`${on.length === 10 ? `${on}T10:00:00Z` : on}`).split(',')[0] : null);
const itemLine = (i: SealItem, what: string) => [i.kind, day(i.on), what].filter(Boolean).join(' · ');

export type CheckView = { tone: 'ok' | 'warn'; title: string; lines: string[] };

export function checkView(c: SealCheck): CheckView {
  if (c.intact) {
    return {
      tone: 'ok',
      title: 'Nothing you sealed has changed',
      lines: [
        `${records(c.unchanged)} exactly as sealed on ${saTime(c.sealedAt)}`,
        ...(c.addedSince ? [`${records(c.addedSince)} added since`] : []),
        ...(c.signatures.mlDsa65 === 'valid' ? ['Both signatures check out, including the post-quantum one'] : []),
      ],
    };
  }
  const n = c.changed.length + c.missing.length;
  return {
    tone: 'warn',
    title: `${records(n)} changed since you sealed`,
    lines: [...c.changed.map((i) => itemLine(i, 'changed')), ...c.missing.map((i) => itemLine(i, 'gone'))],
  };
}
