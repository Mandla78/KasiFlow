import { describe, expect, it } from '@jest/globals';

import { addDays, daysBetween, dueLabel, duePhrase, isIsoDay, monthEnd, nextFriday, shortDate } from '../dueDates';

// 2026-09-25 is a Friday; 2026-09-30 is month-end.
const T = '2026-09-25';

describe('quick pay-back dates', () => {
  it.each([
    [T, '2026-10-02', 'Friday -> next week Friday'],
    ['2026-09-24', '2026-09-25', 'Thursday -> tomorrow'],
    ['2026-09-26', '2026-10-02', 'Saturday'],
  ])('nextFriday(%s) = %s (%s)', (today, friday) => {
    expect(nextFriday(today)).toBe(friday);
  });

  it.each([
    [T, '2026-09-30'],
    ['2026-09-30', '2026-10-31'], // on month-end -> next month's
    ['2026-02-10', '2026-02-28'],
    ['2028-02-10', '2028-02-29'], // leap year
  ])('monthEnd(%s) = %s', (today, end) => {
    expect(monthEnd(today)).toBe(end);
  });
});

describe('calendar maths', () => {
  it('adds days across a year', () => expect(addDays('2026-12-31', 1)).toBe('2027-01-01'));
  it('counts days backwards', () => expect(daysBetween(T, '2026-09-22')).toBe(-3));
  it('counts a month', () => expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31));
  it.each([
    ['2026-02-30', false],
    ['2026-02-28', true],
    ['26-2-28', false],
  ])('isIsoDay(%s) = %p', (value, ok) => expect(isIsoDay(value)).toBe(ok));
});

describe('dueLabel: the tag on each row', () => {
  it.each([
    ['2026-09-22', T, '3 days late', 'late'],
    ['2026-09-24', T, '1 day late', 'late'],
    [T, T, 'Due today', 'today'],
    ['2026-09-26', T, 'Due tomorrow', 'soon'],
    ['2026-09-29', T, 'Due Tue', 'soon'],
    ['2026-10-03', T, 'Next week', 'later'],
    ['2026-09-30', T, 'Month-end', 'soon'], // this month-end beats "Due Wed"
    ['2026-10-31', T, 'Due 31 Oct', 'later'],
    ['2026-10-31', '2026-09-30', 'Month-end', 'later'], // the Month-end chip on month-end day
    ['2026-10-20', T, 'Due 20 Oct', 'later'],
  ])('%s seen on %s -> %s', (dueOn, today, text, tone) => {
    expect(dueLabel(dueOn, today)).toEqual({ text, tone });
  });
});

describe('dates in words', () => {
  it('short date this year', () => expect(shortDate('2026-10-02', T)).toBe('Fri 2 Oct'));
  it('short date next year', () => expect(shortDate('2027-01-08', T)).toBe('Fri 8 Jan 2027'));
  it('today in a message', () => expect(duePhrase(T, T)).toBe('today'));
  it('a day in a message', () => expect(duePhrase('2026-10-02', T)).toBe('on Fri 2 Oct'));
});
