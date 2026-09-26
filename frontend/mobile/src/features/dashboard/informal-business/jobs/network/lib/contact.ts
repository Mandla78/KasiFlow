/**
 * Builders talk where they already talk: WhatsApp and phone calls. We only
 * open a wa.me or tel: link from the builder's own phone; no messages go
 * through Akayza. Numbers are only known between partners (an accepted
 * invite, or picked on a help post).
 */
import { Linking } from 'react-native';

import { whatsappLink } from '@/features/dashboard/informal-business/credit-book/lib/whatsapp';

import type { Offer } from '../types';
import { listText, offerText, paidWhenText } from './pay';
import { daysText, shortDay } from './postText';

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

/** 0821234567 -> tel:+27821234567. */
export function callLink(phone: string): string {
  return `tel:+27${phone.slice(1)}`;
}

/** A first message between partners. */
export function helloText(to: string, from: string): string {
  return `Hi ${firstName(to)}, it's ${firstName(from)} from Akayza. Are you free to talk about work?`;
}

export type Deal = { jobTitle: string; suburb: string; stageNames: string[]; startsOn: string; offer: Offer };

/** The owner to a new partner: the job and the agreed pay, so nobody has to ask. No client, no address. */
export function dealText(to: string, from: string, deal: Deal): string {
  const days = daysText(deal.offer.days);
  return (
    `Hi ${firstName(to)}, it's ${firstName(from)}. You're on ${deal.jobTitle} in ${deal.suburb} with me: ` +
    `${listText(deal.stageNames)}, from ${shortDay(deal.startsOn)}, ${days}. ` +
    `Pay ${offerText(deal.offer)}, ${paidWhenText(deal.offer.paidWhen, deal.stageNames)}. Can we talk?`
  );
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
