/**
 * MOCK notifications: the server's rules on sample data, so every screen
 * works with EXPO_PUBLIC_USE_MOCK_API=true. Same templates (a copy of the
 * backend's platform/notifications/templates.py for the alerts the mock
 * makes), same tabs, one alert per dedupe key, read state, the switches
 * (security always on), pages of 20. mockAlert() is what the mock orders
 * API calls where the server would publish.
 */
import { formatRand } from '@/shared/lib/money';

import type { AppNotification, NotificationLink, NotificationSettings, NotificationsApi, NotificationTab, Unread } from '../types';

type Topic = 'orders' | 'jobs' | 'credit' | 'security';
type Template = { tab: NotificationTab; topic: Topic; icon: string; title: string; body: string };

const order = (icon: string, title: string, body: string): Template => ({ tab: 'orders', topic: 'orders', icon, title, body });
const inbox = (topic: Topic, icon: string, title: string, body: string): Template => ({ tab: 'inbox', topic, icon, title, body });

export const TEMPLATES: Record<string, Template> = {
  'order.sent': order('send', 'Order sent', '{ref} · {total} to {supplier}. Waiting for them to accept.'),
  'order.awaiting_payment': order('credit-card', 'Pay to send it', '{ref} · {total}. Pay in the app to send it to {supplier}.'),
  'order.accepted': order('check-circle', 'Order accepted', '{supplier} accepted {ref}.'),
  'order.rejected': order('x-circle', 'Order not accepted', "{supplier} can't take {ref}."),
  'order.on_its_way': order('truck', 'On its way', '{supplier} is delivering {ref}.'),
  'order.on_its_way_cash': order('truck', 'On its way', '{supplier} is delivering {ref}. Have {total} cash ready.'),
  'order.ready': order('package', 'Ready to collect', '{ref} is ready at {supplier}.'),
  'order.delivered': order('home', 'Delivered', '{ref} was delivered.'),
  'order.collected': order('check', 'Collected', 'You collected {ref}.'),
  'order.paid': order('shield', 'Paid in the app', '{total} for {ref}, confirmed by the payment provider.'),
  'order.expired': order('clock', 'Order lapsed', "{ref} wasn't paid within 24 hours, so it was never sent."),
  'account.new_phone': inbox('security', 'smartphone', 'New phone signed in', 'Your account was opened on a new phone. Not you? Change your password.'),
  'job.done': inbox('jobs', 'award', 'Job done', '{job}: every stage confirmed by the client.'),
  'partner.invited': inbox('jobs', 'user-plus', 'New job invite', '{owner} invites you: {trade}, {stages} · {pay} · starts {day}.'),
  'credit.due_today': inbox('credit', 'book', 'Pay-backs due today', '{customers} due to pay you back today: {amount}.'),
};

type Params = Record<string, string | number>;
type Stored = AppNotification & { dedupeKey: string };

const PAGE = 20;
let items: Stored[] = [];
let switches = { orders: true, jobs: true, credit: true };
let seeded = false;
let counter = 0;

function render(body: string, params: Params): string {
  return body.replace(/\{(\w+)\}/g, (_, name: string) => {
    const cents = params[`${name}_cents`];
    if (typeof cents === 'number') return formatRand(cents);
    return String(params[name] ?? '');
  });
}

/** Where the mock "server" makes an alert. Ignored like the server would: unknown template, a switch off, the same key again. */
export function mockAlert(kind: string, params: Params, link: NotificationLink | null, dedupeKey: string, at: Date = new Date()) {
  const t = TEMPLATES[kind];
  if (!t) return;
  if (t.topic !== 'security' && !switches[t.topic]) return;
  if (items.some((n) => n.dedupeKey === dedupeKey)) return;
  counter += 1;
  items = [
    { id: `mock-n-${counter}`, tab: t.tab, kind, icon: t.icon, title: t.title, body: render(t.body, params), link, createdAt: at.toISOString(), readAt: null, dedupeKey },
    ...items,
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** A few alerts to start with, the way a busy day looks. */
function seed() {
  if (seeded) return;
  seeded = true;
  const ago = (min: number) => new Date(Date.now() - min * 60_000);
  mockAlert('account.new_phone', {}, { type: 'security', id: null }, 'sample:phone', ago(26 * 60));
  mockAlert('credit.due_today', { customers: '1 customer', amount_cents: 4_800 }, { type: 'credit', id: null }, 'sample:due', ago(4 * 60));
  mockAlert('partner.invited', { owner: 'Sipho', trade: 'plumber', stages: 'Final', pay: 'R4,500', day: 'Tue 29 Sep' }, { type: 'invite', id: 'inv-sample' }, 'sample:invite', ago(60));
  mockAlert('order.on_its_way_cash', { ref: 'KF-1042', supplier: 'Mahlangu Wholesale', total_cents: 234_000 }, null, 'sample:order', ago(10));
  // The two oldest were read already.
  items = items.map((n) => (n.dedupeKey === 'sample:phone' || n.dedupeKey === 'sample:due' ? { ...n, readAt: n.createdAt } : n));
}

const wait = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const view = ({ dedupeKey: _key, ...n }: Stored): AppNotification => ({ ...n });

function counts(): Unread {
  return {
    orders: items.filter((n) => n.tab === 'orders' && !n.readAt).length,
    inbox: items.filter((n) => n.tab === 'inbox' && !n.readAt).length,
    latestId: items[0]?.id ?? null,
  };
}

export const mockNotificationsApi: NotificationsApi = {
  async list(tab, before) {
    await wait();
    seed();
    const all = items.filter((n) => n.tab === tab);
    const start = before ? all.findIndex((n) => n.id === before) + 1 : 0;
    const page = all.slice(start, start + PAGE);
    return { notifications: page.map(view), nextBefore: page.length === PAGE ? page[page.length - 1]!.id : null };
  },

  async unread() {
    await wait(80);
    seed();
    return counts();
  },

  async markRead(id) {
    await wait(80);
    const n = items.find((x) => x.id === id);
    if (!n) throw new Error("We couldn't find that notification.");
    if (!n.readAt) n.readAt = new Date().toISOString();
    return { notification: view(n), unread: counts() };
  },

  async markAllRead(tab) {
    await wait(80);
    const now = new Date().toISOString();
    items = items.map((n) => (n.tab === tab && !n.readAt ? { ...n, readAt: now } : n));
    return counts();
  },

  async settings(): Promise<NotificationSettings> {
    await wait(80);
    return { ...switches, security: true };
  },

  async saveSettings(input) {
    await wait();
    switches = { orders: input.orders, jobs: input.jobs, credit: input.credit };
    return { ...switches, security: true };
  },
};

/** TEST ONLY: start again. */
export function resetMockNotifications(withSamples = true) {
  items = [];
  switches = { orders: true, jobs: true, credit: true };
  seeded = !withSamples;
  counter = 0;
}
