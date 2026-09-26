/**
 * Notifications in the app, fed by the server (CONTRACT_notifications.txt
 * section 6). The unread counts come from a poll every 20 s while the app
 * is open (never in the background: data and battery); read state changes
 * go to the server and the badge takes the server's answer, not a guess.
 * Each tab's list loads when it's opened, pulls to refresh, and pages.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { notificationsApi } from '../api/notificationsApi';
import type { AppNotification, NotificationTab, Unread } from '../types';

export const POLL_MS = 20_000;

type TabState = { items: AppNotification[]; nextBefore: string | null; loading: boolean; failed: boolean; loaded: boolean };
type State = { unread: Unread; tabs: Record<NotificationTab, TabState> };

const emptyTab = (): TabState => ({ items: [], nextBefore: null, loading: false, failed: false, loaded: false });
let state: State = { unread: { orders: 0, inbox: 0, latestId: null }, tabs: { orders: emptyTab(), inbox: emptyTab() } };
const listeners = new Set<() => void>();

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function setTab(tab: NotificationTab, next: Partial<TabState>) {
  set({ tabs: { ...state.tabs, [tab]: { ...state.tabs[tab], ...next } } });
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** One poll: the counts, and the open lists again when something new arrived. */
export async function poll(): Promise<void> {
  try {
    const unread = await notificationsApi.unread();
    const changed = unread.latestId !== state.unread.latestId;
    set({ unread });
    if (changed) {
      for (const tab of ['orders', 'inbox'] as const) if (state.tabs[tab].loaded) void loadTab(tab);
    }
  } catch {
    // No signal: keep the last counts; the next poll tries again.
  }
}

export async function loadTab(tab: NotificationTab): Promise<void> {
  setTab(tab, { loading: true, failed: false });
  try {
    const page = await notificationsApi.list(tab);
    setTab(tab, { items: page.notifications, nextBefore: page.nextBefore, loading: false, loaded: true });
  } catch {
    setTab(tab, { loading: false, failed: true });
  }
}

export async function loadMore(tab: NotificationTab): Promise<void> {
  const t = state.tabs[tab];
  if (!t.nextBefore || t.loading) return;
  setTab(tab, { loading: true });
  try {
    const page = await notificationsApi.list(tab, t.nextBefore);
    setTab(tab, { items: [...t.items, ...page.notifications], nextBefore: page.nextBefore, loading: false });
  } catch {
    setTab(tab, { loading: false });
  }
}

/** Opening an alert. The counts are the server's answer. */
export async function markRead(n: AppNotification): Promise<void> {
  if (n.readAt) return;
  try {
    const r = await notificationsApi.markRead(n.id);
    setTab(n.tab, { items: state.tabs[n.tab].items.map((x) => (x.id === n.id ? r.notification : x)) });
    set({ unread: r.unread });
  } catch {
    // Stays unread; it'll be marked next time it's opened.
  }
}

/** "Mark all read": the current tab only. */
export async function markAllRead(tab: NotificationTab): Promise<void> {
  const unread = await notificationsApi.markAllRead(tab);
  const now = new Date().toISOString();
  setTab(tab, { items: state.tabs[tab].items.map((x) => (x.readAt ? x : { ...x, readAt: now })) });
  set({ unread });
}

// ------------------------------------------------------------------ polling

let users = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let appState: { remove: () => void } | null = null;

function startTimer() {
  if (timer) return;
  void poll();
  timer = setInterval(() => void poll(), POLL_MS);
}

function stopTimer() {
  if (timer) clearInterval(timer);
  timer = null;
}

/** Foreground: poll (and at once, to catch up). Background: stop. */
export function onAppState(s: AppStateStatus) {
  if (s === 'active') startTimer();
  else stopTimer();
}

export function isPolling(): boolean {
  return timer !== null;
}

/** Keep the poll running until the returned release is called (counted, so two screens share one poll). */
export function acquirePoll(): () => void {
  users += 1;
  if (users === 1) {
    if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') startTimer();
    appState = AppState.addEventListener('change', onAppState);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    users -= 1;
    if (users === 0) {
      stopTimer();
      appState?.remove();
      appState = null;
    }
  };
}

/** Screens that show counts keep the poll running while they're mounted. */
export function usePoll(): void {
  useEffect(() => acquirePoll(), []);
}

export function useUnread(): Unread & { total: number } {
  const unread = useSyncExternalStore(subscribe, () => state.unread, () => state.unread);
  return { ...unread, total: unread.orders + unread.inbox };
}

export function useTab(tab: NotificationTab): TabState {
  return useSyncExternalStore(subscribe, () => state.tabs[tab], () => state.tabs[tab]);
}

/** TEST ONLY: what the store holds now. */
export function snapshot(): State {
  return state;
}

/** TEST ONLY: start again. */
export function resetNotificationStore() {
  stopTimer();
  appState?.remove();
  appState = null;
  users = 0;
  state = { unread: { orders: 0, inbox: 0, latestId: null }, tabs: { orders: emptyTab(), inbox: emptyTab() } };
}

// ----------------------------------------------------------------- display

const MINUTE = 60_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Just now", "12 min ago", "3 h ago", "Yesterday", "12 Sep". */
export function ago(iso: string, now: number = Date.now()): string {
  const at = Date.parse(iso);
  const min = Math.floor((now - at) / MINUTE);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  if (min < 24 * 60) return `${Math.floor(min / 60)} h ago`;
  if (min < 48 * 60) return 'Yesterday';
  const d = new Date(at);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "Today" or "Earlier", for the group headings. */
export function groupOf(iso: string, now: number = Date.now()): 'Today' | 'Earlier' {
  return new Date(Date.parse(iso)).toDateString() === new Date(now).toDateString() ? 'Today' : 'Earlier';
}
