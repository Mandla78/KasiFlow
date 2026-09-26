import { describe, expect, it } from '@jest/globals';

import type { Order } from '../../types';
import { menuProblem, STARTERS } from '../menus';
import { add, busiestHour, cleanName, count, dayTotals, hourOf, label, lines, linesText, moneyIn, nextStatus, remove, total, waitingText } from '../orders';

const MENU = STARTERS[0]!.items.map((m, i) => ({ ...m, id: `i${i}` }));
const DAY = '2026-09-26';

function order(over: Partial<Order>): Order {
  return {
    id: Math.random().toString(36),
    number: 1,
    tempNumber: 'A1',
    day: DAY,
    lines: [{ itemId: 'i0', name: 'Kota: chips, polony, cheese', priceCents: 3500, qty: 1 }],
    totalCents: 3500,
    payment: 'cash',
    customerName: null,
    status: 'collected',
    createdAt: '2026-09-26T10:15:00.000Z', // 12:15 in South Africa
    statusAt: '2026-09-26T10:15:00.000Z',
    ...over,
  };
}

describe('the cart at the counter', () => {
  it('tap adds, tap again is +1, minus takes one off', () => {
    let cart = add({}, 'i1');
    cart = add(cart, 'i1');
    cart = add(cart, 'i5');
    expect(cart).toEqual({ i1: 2, i5: 1 });
    cart = remove(remove(cart, 'i5'), 'i1');
    expect(cart).toEqual({ i1: 1 });
  });

  it('lines come in menu order, priced from the menu, with a total', () => {
    const ls = lines({ i5: 2, i1: 1 }, MENU);
    expect(ls.map((l) => l.name)).toEqual(['Russian kota', 'Cold drink']);
    expect(total(ls)).toBe(4500 + 2 * 1200);
    expect(count(ls)).toBe(3);
    expect(linesText(ls)).toBe('Russian kota, 2 × Cold drink');
  });
});

describe('the queue', () => {
  it('moves one step at a time and stops at collected', () => {
    expect([nextStatus('new'), nextStatus('preparing'), nextStatus('ready'), nextStatus('collected'), nextStatus('cancelled')]).toEqual(['preparing', 'ready', 'collected', null, null]);
  });

  it('says how long someone has waited', () => {
    const t = Date.parse('2026-09-26T10:00:00Z');
    expect(waitingText('2026-09-26T09:59:40Z', t)).toBe('just now');
    expect(waitingText('2026-09-26T09:56:00Z', t)).toBe('4 min');
    expect(waitingText('2026-09-26T08:55:00Z', t)).toBe('1 h 5 min');
    expect(waitingText('2026-09-26T08:00:00Z', t)).toBe('2 h');
  });

  it("shows the server's number, or this phone's until then", () => {
    expect(label({ number: 12, tempNumber: 'A3' })).toBe('#12');
    expect(label({ number: null, tempNumber: 'A3' })).toBe('A3');
  });

  it('keeps names short and real', () => {
    expect(cleanName('  Thabo   M ')).toBe('Thabo M');
    expect(cleanName('0821234567')).toBeNull();
    expect(cleanName('')).toBeNull();
  });
});

describe('a day in numbers', () => {
  it('money in by how it was paid; pay later is not money in; cancelled does not count', () => {
    const t = dayTotals(DAY, [
      order({ totalCents: 3500 }),
      order({ totalCents: 9000, payment: 'digital', lines: [{ itemId: 'i1', name: 'Russian kota', priceCents: 4500, qty: 2 }] }),
      order({ totalCents: 4500, payment: 'later' }),
      order({ totalCents: 10000, status: 'cancelled' }),
      order({ day: '2026-09-25', totalCents: 99900 }),
    ]);
    expect(t.orders).toBe(3);
    expect([t.cashCents, t.digitalCents, t.laterCents]).toEqual([3500, 9000, 4500]);
    expect(moneyIn(t)).toBe(12500);
    expect(t.bestSellers[0]).toEqual({ name: 'Kota: chips, polony, cheese', qty: 2 });
  });

  it('finds the busiest hour in South African time', () => {
    expect(hourOf('2026-09-26T10:15:00.000Z')).toBe(12);
    const t = dayTotals(DAY, [order({}), order({}), order({ createdAt: '2026-09-26T13:00:00.000Z' })]);
    expect(busiestHour(t)).toEqual({ hour: 12, orders: 2, text: '12:00 to 13:00' });
    expect(busiestHour(dayTotals(DAY, []))).toBeNull();
  });
});

describe('menus', () => {
  it('starter menus are valid', () => {
    for (const s of STARTERS) expect(menuProblem(s.items)).toBeNull();
  });

  it('refuses nameless, doubled and silly-priced items', () => {
    const ok = STARTERS[0]!.items;
    expect(menuProblem([...ok, { name: '  ', priceCents: 100, ingredients: [] }])).toBe('Give every item a name.');
    expect(menuProblem([...ok, { ...ok[0]!, name: 'cold DRINK' }])).toBe('"cold DRINK" is on the menu twice.');
    expect(menuProblem([{ name: 'Kota', priceCents: 0, ingredients: [] }])).toBe('Give Kota a price up to R2,000.');
    expect(menuProblem([{ name: 'Kota', priceCents: 200_001, ingredients: [] }])).toBe('Give Kota a price up to R2,000.');
  });
});
