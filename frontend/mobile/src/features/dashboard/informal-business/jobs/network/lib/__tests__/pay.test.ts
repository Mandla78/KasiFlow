import { describe, expect, it } from '@jest/globals';

import type { Offer, PartnerPayment } from '../../types';
import { checkOffer, confirmedPaid, keepLine, offerText, offerTotal, paidWhenText, paymentStatus, paymentText, payShort, stillOwed } from '../pay';

const fixed: Offer = { kind: 'fixed', amountCents: 450_000, days: 3, paidWhen: 'stage_confirmed' };
const daily: Offer = { kind: 'per_day', amountCents: 60_000, days: 3, paidWhen: 'daily' };

function payment(owner: number, partner: number | null, status: PartnerPayment['status']): PartnerPayment {
  return { id: 'p', ownerAmountCents: owner, partnerAmountCents: partner, status, paidAt: '2026-09-26T10:00:00Z' };
}

describe('the offer', () => {
  it('is a fixed amount or a day rate times the days', () => {
    expect(offerTotal(fixed)).toBe(450_000);
    expect(offerTotal(daily)).toBe(180_000);
    expect(offerText(fixed)).toBe('R4,500');
    expect(offerText(daily)).toBe('R600 a day × 3 days = R1,800');
    expect(payShort(daily)).toBe('R600 a day');
  });

  it('says when it is paid, naming the stages', () => {
    expect(paidWhenText('stage_confirmed', ['Walls'])).toBe('when the client confirms Walls');
    expect(paidWhenText('stage_confirmed', ['Foundation', 'Walls', 'Roof'])).toBe('when the client confirms Foundation, Walls and Roof');
    expect(paidWhenText('daily', ['Walls'])).toBe('every day');
    expect(paidWhenText('end', [])).toBe('at the end of the job');
  });

  it('refuses no pay, silly day rates and too many days', () => {
    expect(checkOffer({ ...fixed, amountCents: 0 })).toBe('Type the pay.');
    expect(checkOffer({ ...daily, amountCents: 1_500_000 })).toMatch(/day rate/);
    expect(checkOffer({ ...daily, days: 61 })).toBe('1 to 60 days.');
    expect(checkOffer(fixed)).toBeNull();
  });
});

describe("the owner's private line", () => {
  it('shows what the owner keeps', () => {
    expect(keepLine(900_000, ['Final'], fixed)).toEqual({ text: 'Final pays you R9,000. You keep R4,500.', loses: false });
    expect(keepLine(2_100_000, ['Roof', 'Final'], fixed).text).toBe('Roof and Final pay you R21,000. You keep R16,500.');
  });

  it('warns when the partner would cost more than the stages pay', () => {
    expect(keepLine(400_000, ['Final'], fixed)).toEqual({ text: "Final pays you R4,000. You'd lose R500 on this.", loses: true });
  });
});

describe('paying a partner', () => {
  it('is confirmed only when both say the same amount', () => {
    expect(paymentStatus(450_000, 450_000)).toBe('confirmed');
    expect(paymentStatus(450_000, 400_000)).toBe('amounts_dont_match');
  });

  it('counts what is confirmed and what is still owed', () => {
    const payments = [payment(100_000, 100_000, 'confirmed'), payment(50_000, null, 'waiting'), payment(20_000, 10_000, 'amounts_dont_match')];
    expect(confirmedPaid(payments)).toBe(100_000);
    expect(stillOwed(fixed, payments)).toBe(300_000);
    expect(stillOwed(fixed, [payment(500_000, 500_000, 'confirmed')])).toBe(0);
  });

  it('reads right from both sides', () => {
    expect(paymentText(payment(450_000, null, 'waiting'), 'owner', 'Thabo')).toBe('Paid R4,500. Waiting for Thabo to confirm.');
    expect(paymentText(payment(450_000, null, 'waiting'), 'partner', 'Nomsa')).toBe('Nomsa says they paid you R4,500.');
    expect(paymentText(payment(450_000, 450_000, 'confirmed'), 'owner', 'Thabo')).toBe('Paid R4,500. Thabo confirmed.');
    expect(paymentText(payment(450_000, 400_000, 'amounts_dont_match'), 'owner', 'Thabo')).toMatch(/^You said R4,500, Thabo said R4,000\./);
  });
});
