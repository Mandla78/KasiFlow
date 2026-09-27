/**
 * Credit written with no signal. A credit sale or a repayment that
 * couldn't reach the server waits here, on the phone, and goes when the
 * signal is back -- in the order it was made. Each carries the
 * Idempotency-Key it was first tried with, so however often it's retried
 * the server records it once. A real refusal (the server's "no") drops it
 * and says why; no signal, a server hiccup or an ended session keeps it.
 *
 * Kept in the phone's secure storage (it holds a customer's name); on the
 * web, the browser's storage. At most MAX_WAITING at a time.
 */
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { ApiError } from '@/shared/api/client';
import { isRetryable } from '@/shared/api/retryable';

import type { NewCreditSale, NewRepayment } from '../types';

export const MAX_WAITING = 50;

export type Pending =
  | { key: string; kind: 'sale'; input: NewCreditSale; label: string; at: string }
  | { key: string; kind: 'repayment'; entryId: string; input: NewRepayment; label: string; at: string };

export type Sender = {
  addSale(input: NewCreditSale, key?: string): Promise<unknown>;
  recordRepayment(id: string, input: NewRepayment, key?: string): Promise<unknown>;
};

export type PendingFlush = {
  sent: number;
  /** Still waiting, in order. */
  left: Pending[];
  /** The last try couldn't reach the server. */
  offline: boolean;
  refused: { item: Pending; message: string }[];
};

export async function flushPending(items: Pending[], send: Sender): Promise<PendingFlush> {
  const out: PendingFlush = { sent: 0, left: [], offline: false, refused: [] };
  for (let i = 0; i < items.length; i++) {
    const p = items[i]!;
    try {
      if (p.kind === 'sale') await send.addSale(p.input, p.key);
      else await send.recordRepayment(p.entryId, p.input, p.key);
      out.sent += 1;
    } catch (err) {
      if (isRetryable(err)) {
        out.offline = true;
        out.left = items.slice(i);
        return out;
      }
      out.refused.push({ item: p, message: err instanceof ApiError ? err.message : 'Refused.' });
    }
  }
  return out;
}

// ------------------------------------------------------------------ the store

const STORAGE_KEY = 'credit.pending.v1';
type State = { items: Pending[]; refused: PendingFlush['refused'] };
let state: State = { items: [], refused: [] };
let loaded: Promise<void> | null = null;
let sending = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function read(): Promise<string | null> {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
  return SecureStore.getItemAsync(STORAGE_KEY);
}

async function write(): Promise<void> {
  const text = JSON.stringify(state.items);
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(STORAGE_KEY, text);
    else await SecureStore.setItemAsync(STORAGE_KEY, text);
  } catch {
    // Storage full or unavailable: it stays in memory for this session.
  }
}

function load(): Promise<void> {
  loaded ??= read()
    .then((raw) => {
      if (raw) state = { ...state, items: JSON.parse(raw) as Pending[] };
    })
    .catch(() => undefined)
    .then(emit);
  return loaded;
}

/** Save a write that couldn't go now. False when the phone is already holding MAX_WAITING. */
export async function keepForLater(p: Pending): Promise<boolean> {
  await load();
  if (state.items.length >= MAX_WAITING) return false;
  state = { ...state, items: [...state.items, p] };
  emit();
  await write();
  return true;
}

/** Try to send everything waiting. Null when there was nothing to send (or a send is already running). */
export async function sendWaiting(send: Sender): Promise<PendingFlush | null> {
  await load();
  if (sending || state.items.length === 0) return null;
  sending = true;
  try {
    const r = await flushPending(state.items, send);
    state = { items: r.left, refused: [...state.refused, ...r.refused] };
    emit();
    await write();
    return r;
  } finally {
    sending = false;
  }
}

export function dismissRefused(): void {
  state = { ...state, refused: [] };
  emit();
}

export function usePending(): State {
  load();
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

/** Tests only. */
export function resetPending(): void {
  state = { items: [], refused: [] };
  loaded = null;
  sending = false;
}
