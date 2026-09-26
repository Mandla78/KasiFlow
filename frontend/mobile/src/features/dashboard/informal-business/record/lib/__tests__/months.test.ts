import { expect, test } from '@jest/globals';

import { addMonths, inMonth, monthLabel, monthName, thisMonth } from '../months';

test("this month is South Africa's month", () => {
  expect(thisMonth(Date.parse('2026-09-30T21:59:00Z'))).toBe('2026-09'); // 23:59 in SA
  expect(thisMonth(Date.parse('2026-09-30T22:00:00Z'))).toBe('2026-10'); // midnight in SA
});

test('months add across years', () => {
  expect(addMonths('2026-01', -1)).toBe('2025-12');
  expect(addMonths('2025-12', 1)).toBe('2026-01');
  expect(addMonths('2026-09', -12)).toBe('2025-09');
});

test('months read as words', () => {
  expect(monthLabel('2026-09')).toBe('September 2026');
  expect(monthName('2026-01')).toBe('January');
});

test("a day or a time is in a month by South Africa's calendar", () => {
  expect(inMonth('2026-09-30', '2026-09')).toBe(true);
  expect(inMonth('2026-10-01', '2026-09')).toBe(false);
  expect(inMonth('2026-08-31T22:30:00Z', '2026-09')).toBe(true); // 00:30 on 1 September in SA
  expect(inMonth('2026-08-31T21:30:00Z', '2026-09')).toBe(false);
});
