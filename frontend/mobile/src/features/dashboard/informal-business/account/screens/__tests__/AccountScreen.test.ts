/**
 * Account shows the trader's tools with live lines only (plan v2 03): no
 * "sample" numbers, no footnote, and the month's money lives in My record.
 * Read from the source, since the screen needs a signed-in session to render.
 */
import { expect, test } from '@jest/globals';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const source = readFileSync(join(__dirname, '..', 'AccountScreen.tsx'), 'utf8');

test('no sample numbers or marks', () => {
  expect(source).not.toMatch(/sample/i);
  expect(existsSync(join(__dirname, '..', '..', 'mock.ts'))).toBe(false);
});

test("this month's money has left Account for My record", () => {
  expect(source).not.toMatch(/This month|Stock bought|Credit given|Paid back/);
  expect(source).toContain("href: '/informal-business/record'");
  expect(source).toContain('Your money, kept apart');
});
