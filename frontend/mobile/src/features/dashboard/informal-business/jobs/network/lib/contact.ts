/**
 * Builders talk where they already talk: WhatsApp and phone calls. We only
 * open a wa.me or tel: link from the builder's own phone; no messages go
 * through Akayza. Numbers are only known once two builders are connected
 * (or one picked the other on a help post).
 */
import { Linking } from 'react-native';

import { whatsappLink } from '@/features/dashboard/informal-business/credit-book/lib/whatsapp';

import { daysText, shortDay } from './postText';
import { tradeLabel, type Trade } from './trades';

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

/** 0821234567 -> tel:+27821234567. */
export function callLink(phone: string): string {
  return `tel:+27${phone.slice(1)}`;
}

/** The first message to a builder you're connected to. */
export function helloText(to: string, from: string): string {
  return `Hi ${firstName(to)}, it's ${firstName(from)}. We're connected on Akayza. Are you free to talk about work?`;
}

/** After picking someone on a help post: what the job is, so they don't have to ask. */
export function pickedText(to: string, from: string, post: { trade: Trade; what: string; suburb: string; startsOn: string; days: number }): string {
  return `Hi ${firstName(to)}, it's ${firstName(from)}. I picked you for the ${tradeLabel(post.trade).toLowerCase()} work on Akayza: ${post.what.trim()} in ${post.suburb}, from ${shortDay(post.startsOn)}, ${daysText(post.days)}. Can we talk?`;
}

async function open(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

export function openWhatsApp(phone: string, text: string): Promise<boolean> {
  return open(whatsappLink(phone, text));
}

export function call(phone: string): Promise<boolean> {
  return open(callLink(phone));
}
