/**
 * Hide or show money on screen (Home's card, My record). A viewing choice
 * for THIS phone only: kept in the phone's secure storage, never sent to
 * the server. Hidden by default, so a balance isn't on show the moment the
 * app opens in front of a customer. If storage can't be read, it stays
 * hidden. Every screen using it follows the same switch.
 */
import * as SecureStore from 'expo-secure-store';
import { useEffect, useSyncExternalStore } from 'react';

import { formatRand, type Cents } from '@/shared/lib/money';

const KEY = 'balances.hidden';
let hidden = true;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const v = await SecureStore.getItemAsync(KEY);
    if (v === 'false') {
      hidden = false;
      emit();
    }
  } catch {
    // Unreadable: stay hidden.
  }
}

export function setBalancesHidden(v: boolean) {
  hidden = v;
  emit();
  SecureStore.setItemAsync(KEY, v ? 'true' : 'false').catch(() => {});
}

/** Tests only: back to the default. */
export function resetBalancesHidden() {
  hidden = true;
  loaded = false;
}

export function useHideBalances(): { hidden: boolean; toggle: () => void; money: (cents: Cents | number) => string } {
  useEffect(() => {
    load();
  }, []);
  const h = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => hidden,
    () => hidden,
  );
  return { hidden: h, toggle: () => setBalancesHidden(!h), money: (c) => (h ? 'R ••••' : formatRand(c as Cents)) };
}
