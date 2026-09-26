import { describe, expect, it } from '@jest/globals';

import { ApiError } from '@/shared/api/client';

import type { NewOrder, Order, OrderStatus } from '../../types';
import { Entry, flush, isRetryable, merge, unsentIds } from '../outbox';

function newOrder(id: string): NewOrder {
  return { id, day: '2026-09-26', tempNumber: `A${id}`, lines: [{ itemId: 'i0', qty: 1 }], payment: 'cash', customerName: null, createdAt: `2026-09-26T10:0${id}:00Z` };
}

function served(n: NewOrder, number: number, status: OrderStatus = 'new'): Order {
  return { id: n.id, number, tempNumber: n.tempNumber, day: n.day, lines: [], totalCents: 3500, payment: n.payment, customerName: null, status, createdAt: n.createdAt, statusAt: n.createdAt };
}

/** A fake server: numbers orders, remembers them; fails when told to. */
function server(opts: { downAfter?: number; refuse?: string } = {}) {
  const orders = new Map<string, Order>();
  let calls = 0;
  return {
    orders,
    async create(o: NewOrder) {
      if (opts.downAfter !== undefined && calls++ >= opts.downAfter) throw new TypeError('Network request failed');
      if (opts.refuse === o.id) throw new ApiError(422, 'VALIDATION_ERROR', "That item isn't on the menu any more.");
      const existing = orders.get(o.id);
      if (existing) return existing;
      const made = served(o, orders.size + 1);
      orders.set(o.id, made);
      return made;
    },
    async setStatus(id: string, status: OrderStatus) {
      if (opts.downAfter !== undefined && calls++ >= opts.downAfter) throw new TypeError('Network request failed');
      const o = orders.get(id);
      if (!o) throw new ApiError(404, 'NOT_FOUND', 'Not found.');
      const next = { ...o, status };
      orders.set(id, next);
      return next;
    },
  };
}

describe('the outbox', () => {
  it('sends everything in order', async () => {
    const s = server();
    const entries: Entry[] = [{ kind: 'create', order: newOrder('1') }, { kind: 'create', order: newOrder('2') }, { kind: 'status', id: '1', status: 'preparing', at: 'x' }];
    const r = await flush(entries, s);
    expect(r.left).toEqual([]);
    expect(r.offline).toBe(false);
    expect(r.sent.map((o) => [o.id, o.number, o.status])).toEqual([['1', 1, 'new'], ['2', 2, 'new'], ['1', 1, 'preparing']]);
  });

  it('stops at a dropped signal and keeps the rest, in order', async () => {
    const entries: Entry[] = [{ kind: 'create', order: newOrder('1') }, { kind: 'create', order: newOrder('2') }, { kind: 'create', order: newOrder('3') }];
    const r = await flush(entries, server({ downAfter: 1 }));
    expect(r.offline).toBe(true);
    expect(r.sent.map((o) => o.id)).toEqual(['1']);
    expect(r.left).toEqual(entries.slice(1));
    expect(unsentIds(r.left)).toEqual(new Set(['2', '3']));
  });

  it('a retry lands once: the same number', async () => {
    const s = server();
    const once = await flush([{ kind: 'create', order: newOrder('1') }], s);
    const again = await flush([{ kind: 'create', order: newOrder('1') }], s);
    expect(again.sent[0]!.number).toBe(once.sent[0]!.number);
    expect(s.orders.size).toBe(1);
  });

  it('drops a refused order (and its steps) and says why, but goes on', async () => {
    const entries: Entry[] = [{ kind: 'create', order: newOrder('1') }, { kind: 'status', id: '1', status: 'preparing', at: 'x' }, { kind: 'create', order: newOrder('2') }];
    const r = await flush(entries, server({ refuse: '1' }));
    expect(r.refused.map((x) => x.message)).toEqual(["That item isn't on the menu any more."]);
    expect(r.sent.map((o) => o.id)).toEqual(['2']);
    expect(r.left).toEqual([]);
  });

  it('knows what to try again', () => {
    expect(isRetryable(new TypeError('Network request failed'))).toBe(true);
    expect(isRetryable(new ApiError(503, 'X', 'down'))).toBe(true);
    expect(isRetryable(new ApiError(429, 'RATE_LIMITED', 'slow down'))).toBe(true);
    expect(isRetryable(new ApiError(422, 'VALIDATION_ERROR', 'no'))).toBe(false);
  });

  it("lays this phone's unsent changes over the server's copy", () => {
    const a = served(newOrder('1'), 1);
    const b = served(newOrder('2'), 2);
    const unsent: Order = { ...served(newOrder('3'), 0), number: null };
    const moved: Order = { ...a, status: 'ready', statusAt: 'later' };
    const entries: Entry[] = [{ kind: 'status', id: '1', status: 'ready', at: 'later' }, { kind: 'create', order: newOrder('3') }];
    const shown = merge([a, b], [moved, unsent], entries);
    expect(shown.map((o) => [o.id, o.status, o.number])).toEqual([['1', 'ready', 1], ['2', 'new', 2], ['3', 'new', null]]);
  });
});
