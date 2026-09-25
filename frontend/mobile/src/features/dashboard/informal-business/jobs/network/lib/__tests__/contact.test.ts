import { describe, expect, it } from '@jest/globals';

import { whatsappLink } from '@/features/dashboard/informal-business/credit-book/lib/whatsapp';

import { callLink, dealText, helloText } from '../contact';
import { daysText, neededText, postDetails, startChoices } from '../postText';

describe('contact', () => {
  it('calls in the international form', () => {
    expect(callLink('0761234501')).toBe('tel:+27761234501');
  });

  it('says hello by first names only', () => {
    expect(helloText('Thabo Nkosi', 'Nomsa Dlamini')).toBe("Hi Thabo, it's Nomsa from Akayza. Are you free to talk about work?");
  });

  it('tells a new partner the job and the pay, with no client or address', () => {
    const text = dealText('Thabo Nkosi', 'Nomsa Dlamini', {
      jobTitle: 'Room extension',
      suburb: 'Tembisa',
      stageNames: ['Final'],
      startsOn: '2026-09-28',
      offer: { kind: 'fixed', amountCents: 450_000, days: 3, paidWhen: 'stage_confirmed' },
    });
    expect(text).toBe(
      "Hi Thabo, it's Nomsa. You're on Room extension in Tembisa with me: Final, from Mon 28 Sep, 3 days. Pay R4,500, when the client confirms Final. Can we talk?",
    );
    expect(whatsappLink('0761234501', text)).toMatch(/^https:\/\/wa\.me\/27761234501\?text=Hi%20Thabo/);
  });
});

describe('post text', () => {
  const T = '2026-09-25';

  it('reads like the plan: trade needed, suburb, km, when, how long', () => {
    expect(neededText('plumber')).toBe('Plumber needed');
    expect(daysText(1)).toBe('1 day');
    expect(postDetails({ suburb: 'Ivory Park', distanceKm: 3.14, startsOn: '2026-09-26', days: 2, mine: false }, T)).toBe('Ivory Park · 3.1 km · from tomorrow · 2 days');
    expect(postDetails({ suburb: 'Tembisa', distanceKm: 0, startsOn: T, days: 1, mine: true }, T)).toBe('Tembisa · from today · 1 day');
  });

  it('offers the next two weeks to start', () => {
    const days = startChoices(T);
    expect(days).toHaveLength(14);
    expect(days[0]).toEqual({ iso: T, label: 'Today' });
    expect(days[1]!.label).toBe('Tomorrow');
    expect(days[2]).toEqual({ iso: '2026-09-27', label: 'Sun 27 Sep' });
    expect(days[13]!.iso).toBe('2026-10-08');
  });
});
