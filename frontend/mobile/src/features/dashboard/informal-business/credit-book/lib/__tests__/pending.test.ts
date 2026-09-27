/**
 * Credit written with no signal waits on the phone and goes later, in
 * order, each with its own Idempotency-Key -- and a dropped signal (what
 * our API client really throws) never counts as a refusal.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ApiError } from '@/shared/api/client';

import { flushPending, keepForLater, MAX_WAITING, Pending, resetPending, sendWaiting } from '../pending';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => mockStore.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => {
    mockStore.set(k, v);
  },
}));

const sale = (key: string, name = 'Thandi'): Pending => ({
  key,
  kind: 'sale',
  input: { customer: { name, phone: null }, amountCents: 10_000, description: '', givenOn: '2026-09-26', dueOn: '2026-10-03' },
  label: `${name} · R100 credit`,
  at: '2026-09-26T20:00:00Z',
});
const repayment = (key: string): Pending => ({
  key,
  kind: 'repayment',
  entryId: 'e1',
  input: { amountCents: 3_000, paidOn: '2026-09-26' },
  label: 'Repayment R30 · Thandi',
  at: '2026-09-26T20:05:00Z',
});

const NO_SIGNAL = new ApiError(0, 'NETWORK', "Can't reach Akayza. Check your connection and try again.");

/** A fake server that records every call with its key, and fails when told to. */
function server(fail: (call: number) => Error | null = () => null) {
  const calls: { what: string; key?: string }[] = [];
  const hit = async (what: string, key?: string) => {
    const e = fail(calls.length);
    calls.push({ what, key });
    if (e) throw e;
    return {};
  };
  return {
    calls,
    addSale: (_i: unknown, key?: string) => hit('sale', key),
    recordRepayment: (id: string, _i: unknown, key?: string) => hit(`repay ${id}`, key),
  };
}

beforeEach(() => {
  mockStore.clear();
  resetPending();
});

describe('sending what waited', () => {
  it('goes in order, each with the key it was first tried with', async () => {
    const s = server();
    const r = await flushPending([sale('k1'), repayment('k2')], s);
    expect(r).toEqual({ sent: 2, left: [], offline: false, refused: [] });
    expect(s.calls).toEqual([
      { what: 'sale', key: 'k1' },
      { what: 'repay e1', key: 'k2' },
    ]);
  });

  it("keeps everything when there's still no signal -- never drops it as refused", async () => {
    const items = [sale('k1'), repayment('k2')];
    const r = await flushPending(items, server(() => NO_SIGNAL));
    expect(r.offline).toBe(true);
    expect(r.refused).toEqual([]);
    expect(r.left).toEqual(items);
  });

  it('stops where the signal dropped and keeps the rest in order', async () => {
    const items = [sale('k1'), sale('k2', 'Sipho'), repayment('k3')];
    const r = await flushPending(items, server((n) => (n === 1 ? NO_SIGNAL : null)));
    expect(r.sent).toBe(1);
    expect(r.left).toEqual(items.slice(1));
  });

  it('keeps it when the session ended (after signing in again it can still go)', async () => {
    const r = await flushPending([sale('k1')], server(() => new ApiError(401, 'TOKEN_EXPIRED', 'Sign in again.')));
    expect(r.left).toHaveLength(1);
  });

  it("drops only what the server refused, and says why", async () => {
    const items = [sale('k1'), repayment('k2'), sale('k3', 'Sipho')];
    const r = await flushPending(items, server((n) => (n === 1 ? new ApiError(422, 'VALIDATION_ERROR', 'That entry is already paid.') : null)));
    expect(r.sent).toBe(2);
    expect(r.left).toEqual([]);
    expect(r.refused).toEqual([{ item: items[1], message: 'That entry is already paid.' }]);
  });
});

describe('keeping it on the phone', () => {
  it('survives the app closing: what waits is stored, and goes once later', async () => {
    expect(await keepForLater(sale('k1'))).toBe(true);
    expect(JSON.parse(mockStore.get('credit.pending.v1')!)).toHaveLength(1);

    resetPending(); // the app was closed and opened again
    const s = server();
    const r = await sendWaiting(s);
    expect(r?.sent).toBe(1);
    expect(s.calls).toEqual([{ what: 'sale', key: 'k1' }]);
    expect(JSON.parse(mockStore.get('credit.pending.v1')!)).toEqual([]);
    expect(await sendWaiting(s)).toBeNull(); // nothing left: nothing sent twice
  });

  it(`holds at most ${MAX_WAITING}`, async () => {
    for (let i = 0; i < MAX_WAITING; i++) expect(await keepForLater(sale(`k${i}`))).toBe(true);
    expect(await keepForLater(sale('one-too-many'))).toBe(false);
  });
});
