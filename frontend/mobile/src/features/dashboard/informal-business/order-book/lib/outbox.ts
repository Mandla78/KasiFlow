/**
 * When the signal drops, the counter keeps going: every order and every
 * step in the queue is saved on the phone first, then sent in order. Each
 * order carries its own key (its id), so a retry lands once and keeps the
 * number the server gave it.
 *
 *   network down / server 5xx   stop, keep everything, try again later
 *   refused (4xx)               drop that one entry and say why
 */
import { ApiError } from '@/shared/api/client';
import { isRetryable } from '@/shared/api/retryable';

import type { NewOrder, Order, OrderStatus } from '../types';

export type Entry = { kind: 'create'; order: NewOrder } | { kind: 'status'; id: string; status: OrderStatus; at: string };

export type Sender = {
  create(order: NewOrder): Promise<Order>;
  setStatus(id: string, status: OrderStatus, at: string): Promise<Order>;
};

export type FlushResult = {
  /** The server's version of every order that went through. */
  sent: Order[];
  /** Still waiting (in order). */
  left: Entry[];
  /** The last try couldn't reach the server. */
  offline: boolean;
  /** Entries the server refused, with its reason. */
  refused: { entry: Entry; message: string }[];
};

// No signal (the client's ApiError(0, 'NETWORK')), a server hiccup or an
// ended session: keep the entry and try again (shared/api/retryable.ts).
export { isRetryable };

export async function flush(entries: Entry[], send: Sender): Promise<FlushResult> {
  const out: FlushResult = { sent: [], left: [], offline: false, refused: [] };
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    // A step for an order that was refused can't go either.
    if (e.kind === 'status' && out.refused.some((r) => r.entry.kind === 'create' && r.entry.order.id === e.id)) continue;
    try {
      out.sent.push(e.kind === 'create' ? await send.create(e.order) : await send.setStatus(e.id, e.status, e.at));
    } catch (err) {
      if (isRetryable(err)) {
        out.offline = true;
        out.left = entries.slice(i);
        return out;
      }
      out.refused.push({ entry: e, message: err instanceof ApiError ? err.message : 'Refused.' });
    }
  }
  return out;
}

/** Ids of orders the server hasn't got yet. */
export function unsentIds(entries: Entry[]): Set<string> {
  return new Set(entries.filter((e): e is Extract<Entry, { kind: 'create' }> => e.kind === 'create').map((e) => e.order.id));
}

/**
 * The day's orders as the counter should see them: the server's, with this
 * phone's changes that haven't gone through laid on top (a local step is
 * newer than the server's copy until it's sent).
 */
export function merge(server: Order[], local: Order[], entries: Entry[]): Order[] {
  const byId = new Map(server.map((o) => [o.id, o]));
  const pending = new Set(entries.map((e) => (e.kind === 'create' ? e.order.id : e.id)));
  for (const o of local) {
    if (!byId.has(o.id) || pending.has(o.id)) {
      const s = byId.get(o.id);
      byId.set(o.id, s ? { ...s, status: o.status, statusAt: o.statusAt } : o);
    }
  }
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
