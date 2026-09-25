/**
 * In-app notifications, in memory for now (the backend will store them and
 * send the matching emails, docs/supplier/08). Orders add theirs here as
 * they move: placed, accepted, on its way, delivered.
 */
import { useSyncExternalStore } from 'react';

import { notifications as SAMPLES } from '../mock';

export type AppNotification = {
  id: string;
  icon: string;
  title: string;
  body: string;
  at: number;
  unread: boolean;
  /** Where tapping it goes, e.g. the order. */
  href?: string;
};

const MINUTE = 60_000;
const agoOf: Record<string, number> = { '10 min ago': 10 * MINUTE, '1 h ago': 60 * MINUTE, '8:00': 4 * 60 * MINUTE, Yesterday: 24 * 60 * MINUTE };

let items: AppNotification[] = SAMPLES.map((n) => ({
  id: n.id,
  icon: n.icon,
  title: n.title,
  body: n.body,
  unread: n.unread,
  at: Date.now() - (agoOf[n.when] ?? 0),
}));
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function notify(n: Omit<AppNotification, 'id' | 'at' | 'unread'>) {
  items = [{ ...n, id: `n-${Date.now()}-${items.length}`, at: Date.now(), unread: true }, ...items];
  emit();
}

export function markAllRead() {
  items = items.map((n) => ({ ...n, unread: false }));
  emit();
}

export function markRead(id: string) {
  items = items.map((n) => (n.id === id ? { ...n, unread: false } : n));
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useNotifications(): AppNotification[] {
  return useSyncExternalStore(subscribe, () => items, () => items);
}

export function useUnreadCount(): number {
  return useNotifications().filter((n) => n.unread).length;
}

/** "Just now", "12 min ago", "3 h ago", "Yesterday", "12 Sep". */
export function ago(at: number): string {
  const min = Math.floor((Date.now() - at) / MINUTE);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  if (min < 24 * 60) return `${Math.floor(min / 60)} h ago`;
  if (min < 48 * 60) return 'Yesterday';
  return new Date(at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

/** "Today" or "Earlier", for the group headings. */
export function groupOf(at: number): string {
  return new Date(at).toDateString() === new Date().toDateString() ? 'Today' : 'Earlier';
}
