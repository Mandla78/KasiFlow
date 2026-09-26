/**
 * Notifications on the server (/me/notifications). snake_case on the wire
 * is mapped here and nowhere else.
 */
import { api } from '@/shared/api/client';

import type { AppNotification, NotificationLink, NotificationSettings, NotificationsApi, NotificationTab, Unread } from '../types';

const BASE = '/me/notifications';

type WireNotification = {
  id: string;
  tab: NotificationTab;
  kind: string;
  icon: string;
  title: string;
  body: string;
  link: NotificationLink | null;
  created_at: string;
  read_at: string | null;
};
type WireUnread = { orders: number; inbox: number; latest_id: string | null };

const notification = (n: WireNotification): AppNotification => ({
  id: n.id,
  tab: n.tab,
  kind: n.kind,
  icon: n.icon,
  title: n.title,
  body: n.body,
  link: n.link,
  createdAt: n.created_at,
  readAt: n.read_at,
});

const unread = (u: WireUnread): Unread => ({ orders: u.orders, inbox: u.inbox, latestId: u.latest_id });

export const httpNotificationsApi: NotificationsApi = {
  async list(tab, before) {
    const q = `tab=${tab}${before ? `&before=${encodeURIComponent(before)}` : ''}`;
    const r = await api<{ notifications: WireNotification[]; next_before: string | null }>('GET', `${BASE}?${q}`, undefined, { auth: true });
    return { notifications: r.notifications.map(notification), nextBefore: r.next_before };
  },

  async unread() {
    return unread((await api<{ unread: WireUnread }>('GET', `${BASE}/unread`, undefined, { auth: true })).unread);
  },

  async markRead(id) {
    const r = await api<{ notification: WireNotification; unread: WireUnread }>('POST', `${BASE}/${encodeURIComponent(id)}/read`, undefined, { auth: true });
    return { notification: notification(r.notification), unread: unread(r.unread) };
  },

  async markAllRead(tab) {
    return unread((await api<{ unread: WireUnread }>('POST', `${BASE}/read-all`, { tab }, { auth: true })).unread);
  },

  async settings() {
    return (await api<{ settings: NotificationSettings }>('GET', '/me/notification-settings', undefined, { auth: true })).settings;
  },

  async saveSettings(input) {
    return (await api<{ settings: NotificationSettings }>('PUT', '/me/notification-settings', input, { auth: true })).settings;
  },
};
