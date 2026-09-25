/**
 * MOCK credit book (EXPO_PUBLIC_USE_MOCK_API=true): every screen works
 * without the backend. Kept on the phone (secure storage) so the book
 * survives a restart; memory only in the web preview. It keeps the
 * server's rules and throws the server's errors
 * (backend/src/domains/informal_trader/credit_book), so switching to
 * httpCreditBookApi changes no screen.
 *
 * The first open fills the book with a few sample entries, like the
 * design, so there is something to tap through.
 */
import * as SecureStore from 'expo-secure-store';

import { ApiError } from '@/shared/api/client';
import { Cents } from '@/shared/lib/money';

import { DESCRIPTION_MAX, MAX_AMOUNT_CENTS, NAME_MAX, REASON_MAX } from '../lib/amounts';
import { addDays, daysBetween, isIsoDay, MAX_DAYS_AHEAD, MAX_DAYS_BACK, nextFriday, todayIso } from '../lib/dueDates';
import { normalisePhone } from '../lib/whatsapp';
import { Corrected, CreditBookApi, CreditEntry, CreditEntryDetail, Customer, CustomerRef, EntryStatus, HistoryItem } from '../types';

// v2: customers only (v1 had supplier debts).
const KEY = 'akayza.mock-credit-book.v2';
const wait = (ms = 400) => new Promise((r) => setTimeout(r, ms));

type StoredCustomer = { id: string; name: string; phone: string | null; createdAt: string };
type StoredEntry = {
  id: string;
  customerId: string;
  amountCents: Cents;
  description: string;
  givenOn: string;
  dueOn: string;
  status: EntryStatus;
  createdAt: string;
  history: HistoryItem[];
};
type Book = { customers: StoredCustomer[]; entries: StoredEntry[] };

let book: Book | null = null;

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function invalid(field: string, message: string): never {
  throw new ApiError(422, 'VALIDATION_ERROR', message, { errors: { [field]: [message] } });
}

function notFound(what: 'entry' | 'customer' = 'entry'): never {
  throw new ApiError(404, 'NOT_FOUND', `We couldn't find that ${what}.`);
}

function sample(): Book {
  const today = todayIso();
  const now = new Date().toISOString();
  const customers: StoredCustomer[] = [
    { id: 'cus-thandi', name: 'Thandi', phone: '0821234567', createdAt: now },
    { id: 'cus-sipho', name: 'Sipho', phone: '0731234567', createdAt: now },
    { id: 'cus-lerato', name: 'Lerato', phone: null, createdAt: now },
    { id: 'cus-mpho', name: 'Mpho', phone: '0611234567', createdAt: now },
  ];
  const entry = (id: string, customerId: string, amount: Cents, description: string, givenOn: string, dueOn: string): StoredEntry => ({
    id,
    customerId,
    amountCents: amount,
    description,
    givenOn,
    dueOn,
    status: 'open',
    createdAt: now,
    history: [{ id: `${id}-given`, type: 'given', on: givenOn, recordedAt: now, amountCents: amount }],
  });
  // R97 given, R20 paid back: R77 left, as in the design.
  const mpho = entry('ent-mpho', 'cus-mpho', 9700, 'Oil, bread', addDays(today, -3), addDays(today, 8));
  mpho.history.push({ id: 'ent-mpho-pay', type: 'repayment', on: addDays(today, -1), recordedAt: now, amountCents: 2000 });
  return {
    customers,
    entries: [
      entry('ent-thandi', 'cus-thandi', 4800, 'Bread, milk', addDays(today, -2), today),
      entry('ent-sipho', 'cus-sipho', 12000, 'Maize meal', addDays(today, -5), nextFriday(today)),
      entry('ent-lerato', 'cus-lerato', 9500, 'Airtime, sugar', addDays(today, -9), addDays(today, -3)),
      mpho,
    ],
  };
}

async function load(): Promise<Book> {
  if (book) return book;
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    book = raw ? (JSON.parse(raw) as Book) : sample();
  } catch {
    book = sample(); // web preview: memory only
  }
  return book;
}

async function save(next: Book) {
  book = next;
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(next));
  } catch {
    // web preview
  }
}

function paidOf(e: StoredEntry): Cents {
  return e.history.reduce((sum, h) => (h.type === 'repayment' ? sum + h.amountCents : sum), 0);
}

function view(b: Book, e: StoredEntry): CreditEntry {
  const c = b.customers.find((x) => x.id === e.customerId);
  const paid = paidOf(e);
  return {
    id: e.id,
    customer: { id: e.customerId, name: c?.name ?? 'Deleted customer', phone: c?.phone ?? null },
    amountCents: e.amountCents,
    paidCents: paid,
    outstandingCents: e.status === 'cancelled' ? 0 : Math.max(e.amountCents - paid, 0),
    description: e.description,
    givenOn: e.givenOn,
    dueOn: e.dueOn,
    status: e.status,
    createdAt: e.createdAt,
  };
}

function detail(b: Book, e: StoredEntry): CreditEntryDetail {
  return { ...view(b, e), history: [...e.history] };
}

function find(b: Book, id: string): StoredEntry {
  return b.entries.find((e) => e.id === id) ?? notFound();
}

function checkAmount(cents: Cents) {
  if (!Number.isInteger(cents) || cents <= 0 || cents > MAX_AMOUNT_CENTS) invalid('amount_cents', 'Enter an amount from R0.01 to R100,000.');
}

function checkText(value: string, field: string, max: number, required: boolean): string {
  const v = value.trim().replace(/\s+/g, ' ');
  if (required && !/\p{L}/u.test(v)) invalid(field, 'Use at least one letter in the name.');
  if (v.length > max) invalid(field, `Use at most ${max} characters.`);
  return v;
}

function checkDue(dueOn: string, givenOn: string) {
  if (!isIsoDay(dueOn)) invalid('due_on', 'Choose a date.');
  if (daysBetween(givenOn, dueOn) < 0) invalid('due_on', "The pay-back date can't be before the day it was given.");
  if (daysBetween(todayIso(), dueOn) > MAX_DAYS_AHEAD) invalid('due_on', 'Choose a date within a year.');
}

function resolveCustomer(b: Book, ref: CustomerRef): StoredCustomer {
  if ('id' in ref) return b.customers.find((c) => c.id === ref.id) ?? notFound('customer');
  const name = checkText(ref.name, 'customer', NAME_MAX, true);
  let phone: string | null = null;
  if (ref.phone) phone = normalisePhone(ref.phone) ?? invalid('customer', 'A cellphone number, like 082 123 4567.');
  const customer = { id: newId('cus'), name, phone, createdAt: new Date().toISOString() };
  b.customers.push(customer);
  return customer;
}

function statusAfter(e: StoredEntry): EntryStatus {
  return paidOf(e) >= e.amountCents ? 'paid' : 'open';
}

function customerView(b: Book, c: StoredCustomer): Customer {
  const owes = b.entries
    .filter((e) => e.customerId === c.id && e.status === 'open')
    .reduce((sum, e) => sum + view(b, e).outstandingCents, 0);
  return { id: c.id, name: c.name, phone: c.phone, owesCents: owes };
}

export const mockCreditBookApi: CreditBookApi = {
  async list() {
    await wait();
    const b = await load();
    const rows = b.entries.filter((e) => e.status !== 'cancelled').map((e) => view(b, e));
    const open = rows.filter((e) => e.status === 'open').sort((x, y) => x.dueOn.localeCompare(y.dueOn));
    const paid = rows.filter((e) => e.status === 'paid').sort((x, y) => y.createdAt.localeCompare(x.createdAt));
    return [...open, ...paid];
  },

  async get(id) {
    await wait(250);
    const b = await load();
    return detail(b, find(b, id));
  },

  async addSale(input) {
    await wait();
    const b = await load();
    const today = todayIso();
    const givenOn = input.givenOn ?? today;
    if (!isIsoDay(givenOn) || daysBetween(givenOn, today) < 0) invalid('given_on', "The day it was given can't be in the future.");
    if (daysBetween(givenOn, today) > MAX_DAYS_BACK) invalid('given_on', 'Only credit from the last year can be added.');
    checkAmount(input.amountCents);
    const description = checkText(input.description, 'description', DESCRIPTION_MAX, false);
    checkDue(input.dueOn, givenOn);
    const customer = resolveCustomer(b, input.customer);
    const now = new Date().toISOString();
    const id = newId('ent');
    const entry: StoredEntry = {
      id,
      customerId: customer.id,
      amountCents: input.amountCents,
      description,
      givenOn,
      dueOn: input.dueOn,
      status: 'open',
      createdAt: now,
      history: [{ id: `${id}-given`, type: 'given', on: givenOn, recordedAt: now, amountCents: input.amountCents }],
    };
    b.entries.push(entry);
    await save(b);
    return detail(b, entry);
  },

  async recordRepayment(id, input) {
    await wait();
    const b = await load();
    const e = find(b, id);
    if (e.status !== 'open') throw new ApiError(409, 'ENTRY_CLOSED', 'This entry is already settled.');
    if (!isIsoDay(input.paidOn) || daysBetween(e.givenOn, input.paidOn) < 0 || daysBetween(input.paidOn, todayIso()) < 0) {
      invalid('paid_on', 'Choose a day between when it was given and today.');
    }
    checkAmount(input.amountCents);
    if (input.amountCents > view(b, e).outstandingCents) invalid('amount_cents', "That's more than what's left to pay.");
    e.history.push({ id: newId('pay'), type: 'repayment', on: input.paidOn, recordedAt: new Date().toISOString(), amountCents: input.amountCents });
    e.status = statusAfter(e);
    await save(b);
    return detail(b, e);
  },

  async correct(id, input) {
    await wait();
    const b = await load();
    const e = find(b, id);
    if (e.status === 'cancelled') throw new ApiError(409, 'ENTRY_CLOSED', 'This entry was cancelled.');
    checkAmount(input.amountCents);
    if (input.amountCents < paidOf(e)) invalid('amount_cents', "The amount can't be less than what's already been paid back.");
    const description = checkText(input.description, 'description', DESCRIPTION_MAX, false);
    checkDue(input.dueOn, e.givenOn);
    const reason = checkText(input.reason, 'reason', REASON_MAX, false);
    const before: Corrected = { amountCents: e.amountCents, dueOn: e.dueOn, description: e.description };
    const after: Corrected = { amountCents: input.amountCents, dueOn: input.dueOn, description };
    if (before.amountCents === after.amountCents && before.dueOn === after.dueOn && before.description === after.description) {
      invalid('amount_cents', 'Nothing was changed.');
    }
    e.history.push({ id: newId('cor'), type: 'correction', on: todayIso(), recordedAt: new Date().toISOString(), before, after, reason });
    Object.assign(e, after);
    e.status = statusAfter(e);
    await save(b);
    return detail(b, e);
  },

  async cancel(id, reason) {
    await wait();
    const b = await load();
    const e = find(b, id);
    if (e.status === 'cancelled') throw new ApiError(409, 'ENTRY_CLOSED', 'This entry was already cancelled.');
    if (paidOf(e) > 0) throw new ApiError(409, 'HAS_REPAYMENTS', 'Money was already paid back on this entry. Correct the amount instead.');
    const why = checkText(reason, 'reason', REASON_MAX, false);
    e.history.push({ id: newId('can'), type: 'cancelled', on: todayIso(), recordedAt: new Date().toISOString(), reason: why });
    e.status = 'cancelled';
    await save(b);
    return detail(b, e);
  },

  async customers(query) {
    await wait(150);
    const b = await load();
    const q = query.trim().toLowerCase();
    const all = b.customers.map((c) => customerView(b, c));
    if (!q) return all.sort((x, y) => x.name.localeCompare(y.name));
    const rank = (c: Customer) => (c.name.toLowerCase().startsWith(q) ? 0 : 1);
    return all.filter((c) => c.name.toLowerCase().includes(q)).sort((x, y) => rank(x) - rank(y) || x.name.localeCompare(y.name));
  },

  async setCustomerPhone(id, phone) {
    await wait();
    const b = await load();
    const c = b.customers.find((x) => x.id === id) ?? notFound('customer');
    c.phone = phone === null ? null : (normalisePhone(phone) ?? invalid('phone', 'A cellphone number, like 082 123 4567.'));
    await save(b);
    return customerView(b, c);
  },

  async summary() {
    await wait(250);
    const b = await load();
    const today = todayIso();
    const month = today.slice(0, 7);
    const live = b.entries.filter((e) => e.status !== 'cancelled');
    const open = live.filter((e) => e.status === 'open').map((e) => view(b, e));
    const dueToday = open.filter((e) => e.dueOn === today);
    return {
      customersOweCents: open.reduce((s, e) => s + e.outstandingCents, 0),
      customersOwing: new Set(open.map((e) => e.customer.id)).size,
      dueTodayCount: dueToday.length,
      dueTodayCents: dueToday.reduce((s, e) => s + e.outstandingCents, 0),
      overdueCount: open.filter((e) => e.dueOn < today).length,
      givenThisMonthCents: live.filter((e) => e.givenOn.startsWith(month)).reduce((s, e) => s + e.amountCents, 0),
      paidBackThisMonthCents: b.entries
        .flatMap((e) => e.history)
        .reduce((s, h) => s + (h.type === 'repayment' && h.on.startsWith(month) ? h.amountCents : 0), 0),
    };
  },
};
