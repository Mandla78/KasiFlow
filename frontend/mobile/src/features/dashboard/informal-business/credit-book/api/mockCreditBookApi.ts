/**
 * MOCK credit book: every screen works before the backend exists. Kept on
 * the phone (secure storage) so the book survives a restart; memory only
 * in the web preview. It keeps the server's rules and throws the server's
 * errors (docs/teammate/feedback/CONTRACT_credit_book.txt), so switching
 * to httpCreditBookApi changes no screen.
 *
 * The first open fills the book with a few sample entries, like the
 * design, so there is something to tap through.
 */
import * as SecureStore from 'expo-secure-store';

import { ApiError } from '@/shared/api/client';
import { Cents } from '@/shared/lib/money';

import { DESCRIPTION_MAX, MAX_AMOUNT_CENTS, NAME_MAX, REASON_MAX, SUPPLIER_NAME_MAX } from '../lib/amounts';
import { addDays, daysBetween, isIsoDay, monthEnd, nextFriday, todayIso } from '../lib/dueDates';
import { normalisePhone } from '../lib/whatsapp';
import {
  Corrected,
  CreditBookApi,
  CreditEntry,
  CreditEntryDetail,
  CreditKind,
  Customer,
  CustomerRef,
  EntryStatus,
  HistoryItem,
} from '../types';

const KEY = 'akayza.mock-credit-book.v1';
/** Due dates up to a year ahead; nobody runs a tab longer than that. */
const MAX_DAYS_AHEAD = 366;
const wait = (ms = 400) => new Promise((r) => setTimeout(r, ms));

type StoredCustomer = { id: string; name: string; phone: string | null; createdAt: string };
type StoredEntry = {
  id: string;
  kind: CreditKind;
  customerId: string | null;
  supplierName: string | null;
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

function notFound(): never {
  throw new ApiError(404, 'NOT_FOUND', "We couldn't find that entry.");
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
  const entry = (id: string, customerId: string | null, supplierName: string | null, amount: Cents, description: string, givenOn: string, dueOn: string): StoredEntry => ({
    id,
    kind: customerId ? 'customer_debt' : 'supplier_debt',
    customerId,
    supplierName,
    amountCents: amount,
    description,
    givenOn,
    dueOn,
    status: 'open',
    createdAt: now,
    history: [{ id: `${id}-given`, type: 'given', on: givenOn, recordedAt: now, amountCents: amount }],
  });
  // R97 given, R20 paid back: R77 left, as in the design.
  const mpho = entry('ent-mpho', 'cus-mpho', null, 9700, 'Oil, bread', addDays(today, -3), addDays(today, 8));
  mpho.history.push({ id: 'ent-mpho-pay', type: 'repayment', on: addDays(today, -1), recordedAt: now, amountCents: 2000 });
  return {
    customers,
    entries: [
      entry('ent-thandi', 'cus-thandi', null, 4800, 'Bread, milk', addDays(today, -2), today),
      entry('ent-sipho', 'cus-sipho', null, 12000, 'Maize meal', addDays(today, -5), nextFriday(today)),
      entry('ent-lerato', 'cus-lerato', null, 9500, 'Airtime, sugar', addDays(today, -9), addDays(today, -3)),
      mpho,
      entry('ent-mahlangu', null, 'Mahlangu Wholesale', 234000, 'Cold drinks, 12 cases', addDays(today, -4), monthEnd(today)),
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
  const c = e.customerId ? b.customers.find((x) => x.id === e.customerId) : undefined;
  const paid = paidOf(e);
  return {
    id: e.id,
    kind: e.kind,
    source: 'trader',
    customer: c ? { id: c.id, name: c.name, phone: c.phone } : null,
    supplierName: e.supplierName,
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

function checkAmount(cents: Cents, field = 'amount_cents', max: Cents = MAX_AMOUNT_CENTS) {
  if (!Number.isInteger(cents) || cents <= 0) invalid(field, 'The amount must be more than R0.');
  if (cents > max) invalid(field, 'That amount is too big.');
}

function checkText(value: string, field: string, max: number, required: boolean): string {
  const v = value.trim();
  if (required && !v) invalid(field, 'This is required.');
  if (v.length > max) invalid(field, `Keep it under ${max} characters.`);
  return v;
}

function checkDue(dueOn: string, givenOn: string) {
  if (!isIsoDay(dueOn)) invalid('due_on', 'Choose a date.');
  if (daysBetween(givenOn, dueOn) < 0) invalid('due_on', "The pay-back date can't be before the day it was given.");
  if (daysBetween(todayIso(), dueOn) > MAX_DAYS_AHEAD) invalid('due_on', 'Choose a date within a year.');
}

function resolveCustomer(b: Book, ref: CustomerRef): StoredCustomer {
  if ('id' in ref) return b.customers.find((c) => c.id === ref.id) ?? invalid('customer_id', 'Choose the customer again.');
  const name = checkText(ref.name, 'customer.name', NAME_MAX, true);
  let phone: string | null = null;
  if (ref.phone) phone = normalisePhone(ref.phone) ?? invalid('customer.phone', 'A cellphone number, like 082 123 4567.');
  const customer = { id: newId('cus'), name, phone, createdAt: new Date().toISOString() };
  b.customers.push(customer);
  return customer;
}

function statusAfter(e: StoredEntry): EntryStatus {
  return paidOf(e) >= e.amountCents ? 'paid' : 'open';
}

function owes(b: Book, customerId: string): Cents {
  return b.entries
    .filter((e) => e.customerId === customerId && e.status === 'open')
    .reduce((sum, e) => sum + view(b, e).outstandingCents, 0);
}

export const mockCreditBookApi: CreditBookApi = {
  async list(kind) {
    await wait();
    const b = await load();
    const rows = b.entries.filter((e) => e.kind === kind && e.status !== 'cancelled').map((e) => view(b, e));
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
    checkAmount(input.amountCents);
    const description = checkText(input.description, 'description', DESCRIPTION_MAX, false);
    checkDue(input.dueOn, today);
    const customer = resolveCustomer(b, input.customer);
    const now = new Date().toISOString();
    const id = newId('ent');
    const entry: StoredEntry = {
      id,
      kind: 'customer_debt',
      customerId: customer.id,
      supplierName: null,
      amountCents: input.amountCents,
      description,
      givenOn: today,
      dueOn: input.dueOn,
      status: 'open',
      createdAt: now,
      history: [{ id: `${id}-given`, type: 'given', on: today, recordedAt: now, amountCents: input.amountCents }],
    };
    b.entries.push(entry);
    await save(b);
    return detail(b, entry);
  },

  async addSupplierDebt(input) {
    await wait();
    const b = await load();
    const today = todayIso();
    const supplierName = checkText(input.supplierName, 'supplier_name', SUPPLIER_NAME_MAX, true);
    checkAmount(input.amountCents);
    const description = checkText(input.description, 'description', DESCRIPTION_MAX, false);
    checkDue(input.dueOn, today);
    const now = new Date().toISOString();
    const id = newId('ent');
    const entry: StoredEntry = {
      id,
      kind: 'supplier_debt',
      customerId: null,
      supplierName,
      amountCents: input.amountCents,
      description,
      givenOn: today,
      dueOn: input.dueOn,
      status: 'open',
      createdAt: now,
      history: [{ id: `${id}-given`, type: 'given', on: today, recordedAt: now, amountCents: input.amountCents }],
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
    const left = view(b, e).outstandingCents;
    checkAmount(input.amountCents, 'amount_cents', left);
    if (!isIsoDay(input.paidOn) || daysBetween(e.givenOn, input.paidOn) < 0 || daysBetween(input.paidOn, todayIso()) < 0) {
      invalid('paid_on', 'Choose a day between when it was given and today.');
    }
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
    const paid = paidOf(e);
    checkAmount(input.amountCents);
    if (input.amountCents < paid) invalid('amount_cents', "The amount can't be less than what's already been paid back.");
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
    const all: Customer[] = b.customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone, owesCents: owes(b, c.id) }));
    if (!q) return all.sort((x, y) => x.name.localeCompare(y.name));
    const rank = (c: Customer) => (c.name.toLowerCase().startsWith(q) ? 0 : 1);
    return all.filter((c) => c.name.toLowerCase().includes(q)).sort((x, y) => rank(x) - rank(y) || x.name.localeCompare(y.name));
  },

  async summary() {
    await wait(250);
    const b = await load();
    const today = todayIso();
    const month = today.slice(0, 7);
    const open = b.entries.filter((e) => e.status === 'open').map((e) => view(b, e));
    const customerOpen = open.filter((e) => e.kind === 'customer_debt');
    const dueToday = customerOpen.filter((e) => e.dueOn === today);
    const customerEntries = b.entries.filter((e) => e.kind === 'customer_debt' && e.status !== 'cancelled');
    return {
      customersOweCents: customerOpen.reduce((s, e) => s + e.outstandingCents, 0),
      customersOwing: new Set(customerOpen.map((e) => e.customer?.id)).size,
      dueTodayCount: dueToday.length,
      dueTodayCents: dueToday.reduce((s, e) => s + e.outstandingCents, 0),
      overdueCount: customerOpen.filter((e) => e.dueOn < today).length,
      youOweSuppliersCents: open.filter((e) => e.kind === 'supplier_debt').reduce((s, e) => s + e.outstandingCents, 0),
      givenThisMonthCents: customerEntries.filter((e) => e.givenOn.startsWith(month)).reduce((s, e) => s + e.amountCents, 0),
      paidBackThisMonthCents: customerEntries
        .flatMap((e) => e.history)
        .filter((h) => h.type === 'repayment' && h.on.startsWith(month))
        .reduce((s, h) => s + (h.type === 'repayment' ? h.amountCents : 0), 0),
    };
  },

  async suppliersOwedFromOrders() {
    // Mandla fills this when orders exist (stock given on credit).
    return [];
  },
};
