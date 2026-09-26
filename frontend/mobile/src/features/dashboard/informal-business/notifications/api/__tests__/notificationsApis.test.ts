/**
 * The mock follows the server's rules (tab from the template, one alert
 * per key, read state, switches with security always on, pages), and the
 * http api maps the server's shapes.
 */
import { beforeEach, expect, jest, test } from '@jest/globals';

type Call = { method: string; path: string; body?: unknown };
const mockCalls: Call[] = [];
let mockReplies: unknown[] = [];
jest.mock('@/shared/api/client', () => ({
  api: async (method: string, path: string, body?: unknown) => {
    mockCalls.push({ method, path, body });
    return mockReplies.shift();
  },
}));

// eslint-disable-next-line import/first
import { httpNotificationsApi } from '../httpNotificationsApi';
// eslint-disable-next-line import/first
import { mockAlert, mockNotificationsApi as api, resetMockNotifications } from '../mockNotificationsApi';

beforeEach(() => {
  resetMockNotifications(false);
  mockCalls.length = 0;
  mockReplies = [];
});

const ORDER = { ref: 'AKZ-1', supplier: 'Mahlangu', total_cents: 234_000 };

test('the template decides the tab, and money is rand', async () => {
  mockAlert('order.on_its_way_cash', ORDER, { type: 'order', id: 'o1' }, 'order:o1:out')
  mockAlert('credit.due_today', { customers: '2 customers', amount_cents: 14_000 }, { type: 'credit', id: null }, 'credit:d')
  const orders = (await api.list('orders')).notifications;
  expect(orders.map((n) => n.body)).toEqual(['Mahlangu is delivering AKZ-1. Have R2,340 cash ready.']);
  expect((await api.list('inbox')).notifications[0]!.body).toBe('2 customers due to pay you back today: R140.');
});

test('the same key lands once; an unknown template never', async () => {
  mockAlert('order.accepted', ORDER, null, 'order:o1:accepted');
  mockAlert('order.accepted', ORDER, null, 'order:o1:accepted');
  mockAlert('order.made_up', ORDER, null, 'x');
  expect((await api.list('orders')).notifications).toHaveLength(1);
});

test('read once, read-all per tab, counts from the store', async () => {
  mockAlert('order.accepted', ORDER, null, 'a');
  mockAlert('order.paid', ORDER, null, 'b');
  mockAlert('job.done', { job: 'Room extension' }, null, 'c');
  expect(await api.unread()).toMatchObject({ orders: 2, inbox: 1 });
  const first = (await api.list('orders')).notifications[0]!;
  const r = await api.markRead(first.id);
  expect(r.notification.readAt).toBeTruthy();
  expect(r.unread).toMatchObject({ orders: 1, inbox: 1 });
  expect(await api.markAllRead('orders')).toMatchObject({ orders: 0, inbox: 1 });
});

test('a switch off stops its alerts; security is always on', async () => {
  const saved = await api.saveSettings({ orders: false, jobs: true, credit: true });
  expect(saved).toEqual({ orders: false, jobs: true, credit: true, security: true });
  mockAlert('order.accepted', ORDER, null, 'a');
  mockAlert('account.new_phone', {}, { type: 'security', id: null }, 'b');
  expect(await api.unread()).toMatchObject({ orders: 0, inbox: 1 });
});

test('pages of 20, newest first', async () => {
  for (let i = 0; i < 25; i++) mockAlert('order.accepted', { ...ORDER, ref: `AKZ-${i}` }, null, `k${i}`, new Date(Date.UTC(2026, 8, 26, 8, i)));
  const one = await api.list('orders');
  expect(one.notifications).toHaveLength(20);
  expect(one.notifications[0]!.body).toBe('Mahlangu accepted AKZ-24.');
  const two = await api.list('orders', one.nextBefore);
  expect(two.notifications.map((n) => n.body)).toEqual([4, 3, 2, 1, 0].map((i) => `Mahlangu accepted AKZ-${i}.`));
  expect(two.nextBefore).toBeNull();
});

test('http: the wire is mapped, and the paths are the contract', async () => {
  mockReplies = [
    { notifications: [{ id: 'n1', tab: 'inbox', kind: 'job.done', icon: 'award', title: 'Job done', body: 'Room extension: every stage confirmed by the client.', link: { type: 'job', id: 'j1' }, created_at: '2026-09-26T10:00:00+00:00', read_at: null }], next_before: null },
    { unread: { orders: 1, inbox: 0, latest_id: 'n1' } },
    { unread: { orders: 0, inbox: 0, latest_id: 'n1' } },
    { settings: { orders: false, jobs: true, credit: true, security: true } },
  ];
  const page = await httpNotificationsApi.list('inbox', 'n0');
  expect(mockCalls[0]).toMatchObject({ method: 'GET', path: '/me/notifications?tab=inbox&before=n0' });
  expect(page.notifications[0]).toMatchObject({ id: 'n1', createdAt: '2026-09-26T10:00:00+00:00', readAt: null, link: { type: 'job', id: 'j1' } });
  expect(await httpNotificationsApi.unread()).toEqual({ orders: 1, inbox: 0, latestId: 'n1' });
  await httpNotificationsApi.markAllRead('orders');
  expect(mockCalls[2]).toMatchObject({ method: 'POST', path: '/me/notifications/read-all', body: { tab: 'orders' } });
  await httpNotificationsApi.saveSettings({ orders: false, jobs: true, credit: true });
  expect(mockCalls[3]).toMatchObject({ method: 'PUT', path: '/me/notification-settings', body: { orders: false, jobs: true, credit: true } });
});
