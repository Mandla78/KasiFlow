/**
 * Rand typed by a person -> integer cents, and the credit book's limits.
 * The same limits are in the API contract; the server checks them again.
 */
import { Cents, formatRand } from '@/shared/lib/money';

/** R100,000: far above any spaza tab, low enough to catch a slipped finger. */
export const MAX_AMOUNT_CENTS: Cents = 10_000_000;
export const NAME_MAX = 60;
export const SUPPLIER_NAME_MAX = 80;
export const DESCRIPTION_MAX = 120;
export const REASON_MAX = 120;

/**
 * "48", "R48.50", "48,50", "1 200", "1,200.00" -> cents; null if it isn't
 * an amount. A comma followed by 1-2 digits is a decimal comma (the South
 * African way); followed by 3 it's a thousands separator.
 */
export function parseRand(text: string): Cents | null {
  let s = text.replace(/[\sR]/gi, '');
  if (!s) return null;
  if (s.includes('.')) s = s.replace(/,/g, '');
  else if (/,\d{1,2}$/.test(s)) s = s.replace(/,(?=\d{1,2}$)/, '.').replace(/,/g, '');
  else s = s.replace(/,(?=\d{3}(\D|$))/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [rands, part = ''] = s.split('.');
  const cents = Number(rands) * 100 + Number(part.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Cents back to what a person would type: 4850 -> "48.50", 4800 -> "48". */
export function centsToInput(cents: Cents): string {
  const rest = cents % 100;
  return rest ? `${Math.floor(cents / 100)}.${String(rest).padStart(2, '0')}` : String(cents / 100);
}

/** One clear message, or '' when the amount is fine. */
export function amountError(text: string, max: Cents = MAX_AMOUNT_CENTS, tooMuch = `The most you can enter is ${formatRand(max)}`): string {
  if (!text.trim()) return 'Type the amount';
  const cents = parseRand(text);
  if (cents === null) return 'Type an amount like 48 or 48.50';
  if (cents <= 0) return 'The amount must be more than R0';
  if (cents > max) return tooMuch;
  return '';
}
