/**
 * What an alert's button opens (CONTRACT_notifications.txt section 6). The
 * server says what the alert is about (type + id); the app decides the
 * screen, so a link can never be a URL someone typed.
 */
import { router } from 'expo-router';

import type { NotificationLink } from '../types';

export function linkLabel(link: NotificationLink | null): string | null {
  switch (link?.type) {
    case 'order':
      return 'View order';
    case 'job':
      return 'View job';
    case 'invite':
      return 'View invite';
    case 'help_post':
      return 'View post';
    case 'credit':
      return 'Open credit book';
    case 'security':
      return 'Check your security';
    default:
      return null;
  }
}

export function openLink(link: NotificationLink | null): void {
  if (!link) return;
  const id = link.id ?? '';
  switch (link.type) {
    case 'order':
      if (id) router.push({ pathname: '/informal-business/orders/[id]', params: { id } });
      return;
    case 'job':
      if (id) router.push({ pathname: '/informal-business/jobs/[id]', params: { id } });
      return;
    case 'invite':
      if (id) router.push({ pathname: '/informal-business/jobs/invites/[inviteId]', params: { inviteId: id } });
      return;
    case 'help_post':
      if (id) router.push({ pathname: '/informal-business/jobs/help/[postId]', params: { postId: id } });
      return;
    case 'credit':
      router.push('/informal-business/credit-book');
      return;
    case 'security':
      router.push('/informal-business/security');
      return;
  }
}
