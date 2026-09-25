/**
 * A partner's pay, stated before they accept (like a driver sees the fare
 * before a trip), and paid in cash between the two builders. Akayza never
 * holds the money; it keeps the record both of them confirmed.
 *
 *   fixed      one amount for the work: "R4,500"
 *   per_day    a day rate: "R600 a day × 3 days = R1,800"
 *
 * Never a percentage of the stage: that would show the partner what the
 * client pays the owner.
 */
import { Cents, formatRand } from '@/shared/lib/money';

import type { Offer, PaidWhen, PartnerPayment } from '../types';

/** R200,000 for one partner's work, R10,000 a day: room, and a slipped finger is caught. */
export const MAX_OFFER_CENTS: Cents = 20_000_000;
export const MAX_DAY_RATE_CENTS: Cents = 1_000_000;

export function offerTotal(offer: Offer): Cents {
  return offer.kind === 'fixed' ? offer.amountCents : offer.amountCents * offer.days;
}

/** "R4,500" or "R600 a day × 3 days = R1,800". */
export function offerText(offer: Offer): string {
  if (offer.kind === 'fixed') return formatRand(offer.amountCents);
  const days = offer.days === 1 ? '1 day' : `${offer.days} days`;
  return `${formatRand(offer.amountCents)} a day × ${days} = ${formatRand(offerTotal(offer))}`;
}

/** Short, for lists: "R4,500" / "R600 a day". */
export function payShort(offer: Offer): string {
  return offer.kind === 'fixed' ? formatRand(offer.amountCents) : `${formatRand(offer.amountCents)} a day`;
}

/** "Walls and Roof", "Foundation, Walls and Roof". */
export function listText(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** "when the client confirms Walls", "every day", "at the end of the job". */
export function paidWhenText(paidWhen: PaidWhen, stageNames: string[]): string {
  if (paidWhen === 'daily') return 'every day';
  if (paidWhen === 'end') return 'at the end of the job';
  return stageNames.length ? `when the client confirms ${listText(stageNames)}` : 'when the client confirms the stage';
}

export function checkOffer(offer: Offer): string | null {
  if (!Number.isInteger(offer.amountCents) || offer.amountCents <= 0) return 'Type the pay.';
  if (offer.kind === 'per_day' && offer.amountCents > MAX_DAY_RATE_CENTS) return `A day rate up to ${formatRand(MAX_DAY_RATE_CENTS)}.`;
  if (!Number.isInteger(offer.days) || offer.days < 1 || offer.days > 60) return '1 to 60 days.';
  if (offerTotal(offer) > MAX_OFFER_CENTS) return `Pay up to ${formatRand(MAX_OFFER_CENTS)}.`;
  return null;
}

/**
 * The owner's private line (the partner never sees it): what the chosen
 * stages pay the owner, and what's left after the partner's pay.
 */
export function keepLine(stagesCents: Cents, stageNames: string[], offer: Offer): { text: string; loses: boolean } {
  const keep = stagesCents - offerTotal(offer);
  const pays = `${listText(stageNames)} ${stageNames.length > 1 ? 'pay' : 'pays'} you ${formatRand(stagesCents)}.`;
  if (keep < 0) return { text: `${pays} You'd lose ${formatRand(-keep)} on this.`, loses: true };
  return { text: `${pays} You keep ${formatRand(keep)}.`, loses: false };
}

/** The same rule as the client's sign-off: the same amount from both, or both are kept. */
export function paymentStatus(ownerCents: Cents, partnerCents: Cents): PartnerPayment['status'] {
  return ownerCents === partnerCents ? 'confirmed' : 'amounts_dont_match';
}

/** Cash both sides confirmed. */
export function confirmedPaid(payments: PartnerPayment[]): Cents {
  return payments.reduce((sum, p) => (p.status === 'confirmed' ? sum + p.ownerAmountCents : sum), 0);
}

/** What the owner still owes on the offer (never below 0). */
export function stillOwed(offer: Offer, payments: PartnerPayment[]): Cents {
  const paid = payments.reduce((sum, p) => sum + (p.status === 'amounts_dont_match' ? 0 : p.ownerAmountCents), 0);
  return Math.max(0, offerTotal(offer) - paid);
}

/** A payment in words, from the owner's side or the partner's. */
export function paymentText(p: PartnerPayment, side: 'owner' | 'partner', otherFirstName: string): string {
  const amount = formatRand(p.ownerAmountCents);
  if (p.status === 'confirmed') return side === 'owner' ? `Paid ${amount}. ${otherFirstName} confirmed.` : `Got ${amount}. You both confirmed.`;
  if (p.status === 'waiting') return side === 'owner' ? `Paid ${amount}. Waiting for ${otherFirstName} to confirm.` : `${otherFirstName} says they paid you ${amount}.`;
  const theirs = formatRand(p.partnerAmountCents ?? 0);
  return side === 'owner'
    ? `You said ${amount}, ${otherFirstName} said ${theirs}. Talk, then record it again. Both numbers stay in the record.`
    : `${otherFirstName} said ${amount}, you said ${theirs}. Both numbers stay in the record.`;
}
