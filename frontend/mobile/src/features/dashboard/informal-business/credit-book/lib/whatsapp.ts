/**
 * Receipts and reminders as WhatsApp messages the TRADER sends from their
 * own phone: we only open a wa.me link with the text filled in. No API,
 * no server messages, and never a link to Akayza in the text (the
 * customer shouldn't need an app or an account).
 *
 * wa.me is an https link, so it still opens (in the browser) on a phone
 * without WhatsApp.
 */
import { Linking } from 'react-native';

import { formatRand } from '@/shared/lib/money';

import { CreditEntry } from '../types';
import { daysBetween, duePhrase, todayIso } from './dueDates';

/** A South African cellphone as the trader types it: 082 123 4567, +27 82 123 4567. */
export function normalisePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (/^0[6-8]\d{8}$/.test(digits)) return digits;
  if (/^27[6-8]\d{8}$/.test(digits)) return `0${digits.slice(2)}`;
  return null;
}

/** 0821234567 -> "082 123 4567". */
export function formatPhone(phone: string): string {
  return `${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6)}`;
}

/** 0821234567 -> 27821234567 (the international form wa.me wants, without +). */
function international(phone: string): string {
  return `27${phone.slice(1)}`;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0];
}

function what(description: string): string {
  return description.trim() ? ` for ${description.trim().replace(/[.!]+$/, '').toLowerCase()}` : '';
}

export function receiptText(entry: CreditEntry, businessName: string, today: string = todayIso()): string {
  const who = entry.customer ? firstName(entry.customer.name) : '';
  return `Hi ${who}, ${businessName}: ${formatRand(entry.amountCents)} on the book${what(entry.description)}, due ${duePhrase(entry.dueOn, today)}. Thank you!`;
}

export function reminderText(entry: CreditEntry, businessName: string, today: string = todayIso()): string {
  const who = entry.customer ? firstName(entry.customer.name) : '';
  const left = formatRand(entry.outstandingCents);
  const late = daysBetween(today, entry.dueOn) < 0;
  return late
    ? `Hi ${who}, friendly reminder from ${businessName}: ${left} was due ${duePhrase(entry.dueOn, today)}. Thank you!`
    : `Hi ${who}, friendly reminder from ${businessName}: ${left} is due ${duePhrase(entry.dueOn, today)}. Thank you!`;
}

export function whatsappLink(phone: string, text: string): string {
  return `https://wa.me/${international(phone)}?text=${encodeURIComponent(text)}`;
}

/** Opens WhatsApp (or the browser) with the message ready; the trader presses send. */
export async function openWhatsApp(phone: string, text: string): Promise<boolean> {
  try {
    await Linking.openURL(whatsappLink(phone, text));
    return true;
  } catch {
    return false;
  }
}
