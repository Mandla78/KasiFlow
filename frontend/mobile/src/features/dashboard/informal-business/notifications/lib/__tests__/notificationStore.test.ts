/**
 * The store: the poll updates the counts, read state comes from the
 * server's answer (never a guess), the poll stops in the background.
 */
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';

import type { AppNotification, Unread } from '../../types';

const mockApi = {
  unread: jest.fn<() => Promise<Unread>>(),
  list: jest.fn<(tab: string, before?: string | null) => Promise<{ notifications: AppNotification[]; nextBefore: string | null }>>(),
  markRead: jest.fn<(id: string) => Promise<{ notification: AppNotification; unread: Unread }>>(),
  markAllRead: jest.fn<(tab: string) => Promise<Unread>>(),
};
// A getter: the store loads before this file's consts exist, so read the mock when it's called.
jest.mock('../../api/notificationsApi', () => ({
  get notificationsApi() {
    return mockApi;
  },
}));

// eslint-disable-next-line import/first
import { acquirePoll, ago, groupOf, isPolling, loadMore, loadTab, markAllRead, markRead, onAppState, poll, POLL_MS, resetNotificationStore, snapshot } from '../notificationStore';

const alert = (id: string, readAt: string | null = null): AppNotification => ({
  id, tab: 'orders', kind: 'order.accepted', icon: 'check-circle', title: 'Order accepted', body: 'Mahlangu accepted AKZ-1.', link: { type: 'order', id: 'o1' }, createdAt: '2026-09-26T10:00:00Z', readAt,
});  // prettier-ignore

beforeEach(() => {
  jest.useFakeTimers();
  resetNotificationStore();
  Object.values(mockApi).forEach((f) => f.mockReset());
  mockApi.unread.mockResolvedValue({ orders: 2, inbox: 1, latestId: 'n2' });
});

afterEach(() => {
  resetNotificationStore();
  jest.useRealTimers();
});

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

test('the poll runs every 20 s while held, and stops when released', async () => {
  const release = acquirePoll();
  await flush();
  expect(mockApi.unread).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(POLL_MS);
  await flush();
  expect(mockApi.unread).toHaveBeenCalledTimes(2);
  release();
  jest.advanceTimersByTime(POLL_MS * 3);
  expect(mockApi.unread).toHaveBeenCalledTimes(2);
  expect(isPolling()).toBe(false);
});

test('the background stops the poll; coming back polls at once', async () => {
  acquirePoll();
  await flush();
  onAppState('background');
  expect(isPolling()).toBe(false);
  jest.advanceTimersByTime(POLL_MS * 3);
  expect(mockApi.unread).toHaveBeenCalledTimes(1);
  onAppState('active');
  await flush();
  expect(isPolling()).toBe(true);
  expect(mockApi.unread).toHaveBeenCalledTimes(2);
});

test('a new alert on the server reloads an open tab', async () => {
  mockApi.list.mockResolvedValue({ notifications: [alert('n1')], nextBefore: null });
  await loadTab('orders');
  expect(mockApi.list).toHaveBeenCalledTimes(1);
  await poll(); // latestId went from null to n2
  await flush();
  expect(mockApi.list).toHaveBeenCalledTimes(2);
  await poll(); // the same latestId: no reload
  await flush();
  expect(mockApi.list).toHaveBeenCalledTimes(2);
});

test('reading one takes the counts from the server, and an already read one calls nothing', async () => {
  mockApi.list.mockResolvedValue({ notifications: [alert('n1')], nextBefore: null });
  await loadTab('orders');
  mockApi.markRead.mockResolvedValue({ notification: alert('n1', '2026-09-26T10:05:00Z'), unread: { orders: 0, inbox: 1, latestId: 'n2' } });
  await markRead(alert('n1'));
  expect(mockApi.markRead).toHaveBeenCalledWith('n1');
  expect(snapshot().unread).toEqual({ orders: 0, inbox: 1, latestId: 'n2' });
  expect(snapshot().tabs.orders.items[0]!.readAt).toBe('2026-09-26T10:05:00Z');
  await markRead(alert('n1', '2026-09-26T10:05:00Z'));
  expect(mockApi.markRead).toHaveBeenCalledTimes(1);
});

test('mark all read is the tab only, with the server answer', async () => {
  mockApi.markAllRead.mockResolvedValue({ orders: 0, inbox: 3, latestId: 'n9' });
  mockApi.list.mockResolvedValue({ notifications: [alert('n1'), alert('n2')], nextBefore: null });
  await loadTab('orders');
  await markAllRead('orders');
  expect(mockApi.markAllRead).toHaveBeenCalledWith('orders');
  expect(snapshot().unread).toEqual({ orders: 0, inbox: 3, latestId: 'n9' });
  expect(snapshot().tabs.orders.items.every((n) => n.readAt)).toBe(true);
});

test('pages load from the last one', async () => {
  mockApi.list.mockResolvedValueOnce({ notifications: [alert('n1'), alert('n2')], nextBefore: 'n2' });
  await loadTab('orders');
  mockApi.list.mockResolvedValueOnce({ notifications: [alert('n3')], nextBefore: null });
  await loadMore('orders');
  expect(mockApi.list).toHaveBeenLastCalledWith('orders', 'n2');
  await loadMore('orders'); // nothing older: no call
  expect(mockApi.list).toHaveBeenCalledTimes(2);
});

test('no signal keeps the last counts', async () => {
  await poll();
  mockApi.unread.mockRejectedValueOnce(new TypeError('Network request failed'));
  await expect(poll()).resolves.toBeUndefined();
});

test('times read like a person says them', () => {
  const now = Date.parse('2026-09-26T12:00:00Z');
  expect(ago('2026-09-26T11:59:40Z', now)).toBe('Just now');
  expect(ago('2026-09-26T11:48:00Z', now)).toBe('12 min ago');
  expect(ago('2026-09-26T09:00:00Z', now)).toBe('3 h ago');
  expect(ago('2026-09-25T10:00:00Z', now)).toBe('Yesterday');
  expect(ago('2026-09-12T10:00:00Z', now)).toBe('12 Sep');
  expect(groupOf('2026-09-26T11:00:00Z', now)).toBe('Today');
  expect(groupOf('2026-09-20T11:00:00Z', now)).toBe('Earlier');
});
