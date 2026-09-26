/**
 * Notifications as the app sees them (docs/teammate/feedback/
 * CONTRACT_notifications.txt): alerts the SERVER makes, in two tabs, with
 * their read state on the server (so the badge is the same on every phone).
 * The wording comes from the server's templates; the app only shows it.
 */

export type NotificationTab = 'orders' | 'inbox';

/** What tapping an alert opens. id is null for "the credit book" and security. */
export type NotificationLink = { type: 'order' | 'job' | 'invite' | 'help_post' | 'credit' | 'security'; id: string | null };

export type AppNotification = {
  id: string;
  tab: NotificationTab;
  /** The template key, e.g. "order.accepted". */
  kind: string;
  /** A Feather icon name. */
  icon: string;
  title: string;
  body: string;
  link: NotificationLink | null;
  createdAt: string;
  readAt: string | null;
};

/** The 20 s poll's answer. latestId changes when a new alert arrives. */
export type Unread = { orders: number; inbox: number; latestId: string | null };

export type NotificationPage = { notifications: AppNotification[]; nextBefore: string | null };

/** The switches. Security is always on. */
export type NotificationSettings = { orders: boolean; jobs: boolean; credit: boolean; security: true };
export type NotificationSettingsInput = Omit<NotificationSettings, 'security'>;

export interface NotificationsApi {
  list(tab: NotificationTab, before?: string | null): Promise<NotificationPage>;
  unread(): Promise<Unread>;
  /** Opening an alert: read once, and the new counts. */
  markRead(id: string): Promise<{ notification: AppNotification; unread: Unread }>;
  /** Only that tab. */
  markAllRead(tab: NotificationTab): Promise<Unread>;
  settings(): Promise<NotificationSettings>;
  saveSettings(input: NotificationSettingsInput): Promise<NotificationSettings>;
}
