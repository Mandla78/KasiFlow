/**
 * What My record shows: three blocks never added together, the eye, an
 * empty month and a tool that's switched off.
 */
import { expect, test } from '@jest/globals';

import type { RecordSummary } from '../../types';
import { HIDDEN, recordView } from '../view';

const zero = { cents: 0, orders: 0 };
const EMPTY: RecordSummary = {
  month: '2026-09',
  firstMonth: '2026-06',
  orders: { providerVerified: zero, confirmedByBoth: zero, notConfirmed: zero },
  creditBook: { givenCents: 0, paidBackCents: 0 },
  jobs: { confirmedCents: 0, confirmedStages: 0, amountsDontMatch: 0 },
};
const FULL: RecordSummary = {
  ...EMPTY,
  orders: { providerVerified: { cents: 123450, orders: 2 }, confirmedByBoth: { cents: 50000, orders: 1 }, notConfirmed: { cents: 35000, orders: 3 } },
  creditBook: { givenCents: 42000, paidBackCents: 15000 },
  jobs: { confirmedCents: 1800000, confirmedStages: 1, amountsDontMatch: 2 },
};
const ON = { creditBook: true, jobs: true };

test('three blocks, each line on its own', () => {
  const v = recordView(FULL, { tools: ON, hidden: false });
  expect(v.empty).toBeNull();
  expect(v.blocks.map((b) => [b.key, b.title])).toEqual([
    ['orders', 'Stock you bought'],
    ['creditBook', 'Your credit book'],
    ['jobs', 'Your jobs'],
  ]);
  expect(v.blocks.map((b) => b.lines.map((l) => [l.label, l.value, l.note]))).toEqual([
    [
      ['Paid in the app, verified by PayFast', 'R1,234.50', '2 orders'],
      ['Cash, confirmed by both', 'R500', '1 order'],
      ['Cash, not confirmed', 'R350', '3 orders'],
    ],
    [
      ['Credit given', 'R420', undefined],
      ['Paid back', 'R150', undefined],
    ],
    [
      ['Stages confirmed by clients', 'R18,000', '1 stage'],
      ["Amounts that don't match", '2', undefined],
    ],
  ]);
});

test('each stock line opens the orders behind it', () => {
  const [stock] = recordView(FULL, { tools: ON, hidden: false }).blocks;
  expect(stock!.lines.map((l) => l.evidence)).toEqual(['provider_verified', 'confirmed_by_both', 'not_confirmed']);
});

test('never a total', () => {
  const text = JSON.stringify(recordView(FULL, { tools: ON, hidden: false })).toLowerCase();
  expect(text).not.toContain('total');
  expect(text).not.toContain('2,084.50'); // the three stock lines added up
});

test('only the PayFast line is proof: the tools are your own record', () => {
  const [, credit, jobs] = recordView(FULL, { tools: ON, hidden: false }).blocks;
  for (const block of [credit!, jobs!]) {
    expect(block.note).toBe('Your own record');
    expect(JSON.stringify(block).toLowerCase()).not.toContain('proof');
  }
});

test('the eye hides the amounts, not the counts', () => {
  const v = recordView(FULL, { tools: ON, hidden: true });
  const lines = v.blocks.flatMap((b) => b.lines);
  const money = lines.filter((l) => l.label !== "Amounts that don't match");
  expect(money.map((l) => l.value)).toEqual(Array(money.length).fill(HIDDEN));
  expect(lines.find((l) => l.label === "Amounts that don't match")!.value).toBe('2');
  expect(lines[0]!.note).toBe('2 orders');
  expect(JSON.stringify(v)).not.toMatch(/R\d/);
});

test('an empty month says so', () => {
  expect(recordView(EMPTY, { tools: ON, hidden: false }).empty).toBe('Nothing recorded in September.');
  expect(recordView({ ...EMPTY, month: '2026-01' }, { tools: ON, hidden: true }).empty).toBe('Nothing recorded in January.');
});

test('a tool switched off says how to switch it on', () => {
  const off = recordView({ ...FULL, creditBook: null, jobs: null }, { tools: { creditBook: false, jobs: false }, hidden: false });
  expect(off.blocks[1]).toMatchObject({ lines: [], off: 'Switch on Credit book in Account.' });
  expect(off.blocks[2]).toMatchObject({ lines: [], off: 'Switch on Jobs in Account.' });
  // Switched off in the app just now: the server's numbers aren't shown.
  const justOff = recordView(FULL, { tools: { creditBook: true, jobs: false }, hidden: false });
  expect(justOff.blocks[2]).toMatchObject({ lines: [], off: 'Switch on Jobs in Account.' });
  expect(justOff.blocks[1]!.off).toBeUndefined();
});

test("a switched-off tool doesn't make a month look busy", () => {
  const v = recordView({ ...EMPTY, creditBook: { givenCents: 5000, paidBackCents: 0 } }, { tools: { creditBook: false, jobs: false }, hidden: false });
  expect(v.empty).toBe('Nothing recorded in September.');
});

test('builders buy materials', () => {
  expect(recordView(FULL, { tools: ON, hidden: false, builder: true }).blocks[0]!.title).toBe('Materials you bought');
});
