import { describe, expect, it } from '@jest/globals';

import { CreditEntry } from '../../types';
import { formatPhone, normalisePhone, receiptText, reminderText, whatsappLink } from '../whatsapp';

const T = '2026-09-25';
const entry: CreditEntry = {
  id: 'e1',
  customer: { id: 'c1', name: 'Thandi Mokoena', phone: '0821234567' },
  amountCents: 4800,
  paidCents: 2000,
  outstandingCents: 2800,
  description: 'Bread and milk.',
  givenOn: T,
  dueOn: '2026-10-02',
  status: 'open',
  createdAt: `${T}T08:00:00Z`,
  binnedAt: null,
};

describe('South African cellphones', () => {
  it.each([
    ['082 123 4567', '0821234567'],
    ['+27 82 123 4567', '0821234567'],
    ['27821234567', '0821234567'],
  ])('%s -> %s', (typed, stored) => expect(normalisePhone(typed)).toBe(stored));

  it.each(['011 123 4567', '08212345'])('refuses %s (landline or too short)', (typed) => expect(normalisePhone(typed)).toBeNull());

  it('shows the number the way people read it', () => expect(formatPhone('0821234567')).toBe('082 123 4567'));
});

describe('WhatsApp messages the trader sends', () => {
  it('receipt', () => {
    expect(receiptText(entry, "Nomsa's Spaza", T)).toBe("Hi Thandi, Nomsa's Spaza: R48 on the book for bread and milk, due on Fri 2 Oct. Thank you!");
  });

  it('reminder before the day', () => {
    expect(reminderText(entry, "Nomsa's Spaza", T)).toBe("Hi Thandi, friendly reminder from Nomsa's Spaza: R28 is due on Fri 2 Oct. Thank you!");
  });

  it('reminder when late', () => {
    expect(reminderText({ ...entry, dueOn: '2026-09-22' }, "Nomsa's Spaza", T)).toBe(
      "Hi Thandi, friendly reminder from Nomsa's Spaza: R28 was due on Tue 22 Sep. Thank you!",
    );
  });

  it('receipt without a description', () => {
    expect(receiptText({ ...entry, description: '' }, 'Spaza', T)).toContain('on the book, due');
  });

  it('link: international number, text encoded (isiZulu and accents survive)', () => {
    const link = whatsappLink('0821234567', 'Sawubona! R48 é');
    expect(link.startsWith('https://wa.me/27821234567?text=')).toBe(true);
    expect(decodeURIComponent(link.split('text=')[1])).toBe('Sawubona! R48 é');
  });
});
