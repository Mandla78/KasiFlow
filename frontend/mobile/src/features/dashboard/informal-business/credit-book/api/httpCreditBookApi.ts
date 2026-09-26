/**
 * The credit book on the server (/me/credit-book). snake_case on the wire
 * is mapped to the app's camelCase here and nowhere else, so screens don't
 * know which API they're talking to. api() attaches the token, refreshes
 * it, and turns the server's refusals into ApiError with its message.
 */
import { api } from '@/shared/api/client';

import { CreditBookApi, CreditEntry, CreditEntryDetail, CreditSummary, Customer, HistoryItem } from '../types';

const BASE = '/me/credit-book';

type WireCustomer = { id: string; name: string; phone: string | null; owes_cents: number };
type WireEntry = {
  id: string;
  customer: { id: string; name: string; phone: string | null };
  amount_cents: number;
  paid_cents: number;
  outstanding_cents: number;
  description: string;
  given_on: string;
  due_on: string;
  status: CreditEntry['status'];
  created_at: string;
  /** Set only on entries in the bin. */
  binned_at: string | null;
};
type WireCorrected = { amount_cents: number; due_on: string; description: string };
type WireHistory =
  | { id: string; type: 'given' | 'repayment'; on: string; recorded_at: string; amount_cents: number }
  | { id: string; type: 'correction'; on: string; recorded_at: string; reason: string; before: WireCorrected; after: WireCorrected }
  | { id: string; type: 'cancelled'; on: string; recorded_at: string; reason: string };
type WireDetail = WireEntry & { history: WireHistory[] };
type WireSummary = {
  customers_owe_cents: number;
  customers_owing: number;
  due_today_count: number;
  due_today_cents: number;
  overdue_count: number;
  given_this_month_cents: number;
  paid_back_this_month_cents: number;
};

const corrected = (c: WireCorrected) => ({ amountCents: c.amount_cents, dueOn: c.due_on, description: c.description });

function entry(e: WireEntry): CreditEntry {
  return {
    id: e.id,
    customer: e.customer,
    amountCents: e.amount_cents,
    paidCents: e.paid_cents,
    outstandingCents: e.outstanding_cents,
    description: e.description,
    givenOn: e.given_on,
    dueOn: e.due_on,
    status: e.status,
    createdAt: e.created_at,
    binnedAt: e.binned_at,
  };
}

function historyItem(h: WireHistory): HistoryItem {
  const base = { id: h.id, on: h.on, recordedAt: h.recorded_at };
  switch (h.type) {
    case 'given':
    case 'repayment':
      return { ...base, type: h.type, amountCents: h.amount_cents };
    case 'correction':
      return { ...base, type: 'correction', reason: h.reason, before: corrected(h.before), after: corrected(h.after) };
    case 'cancelled':
      return { ...base, type: 'cancelled', reason: h.reason };
  }
}

function detail(e: WireDetail): CreditEntryDetail {
  return { ...entry(e), history: e.history.map(historyItem) };
}

function customer(c: WireCustomer): Customer {
  return { id: c.id, name: c.name, phone: c.phone, owesCents: c.owes_cents };
}

function summary(s: WireSummary): CreditSummary {
  return {
    customersOweCents: s.customers_owe_cents,
    customersOwing: s.customers_owing,
    dueTodayCount: s.due_today_count,
    dueTodayCents: s.due_today_cents,
    overdueCount: s.overdue_count,
    givenThisMonthCents: s.given_this_month_cents,
    paidBackThisMonthCents: s.paid_back_this_month_cents,
  };
}

const one = async (method: 'GET' | 'POST', path: string, body?: unknown) =>
  detail((await api<{ entry: WireDetail }>(method, `${BASE}${path}`, body, { auth: true })).entry);

export const httpCreditBookApi: CreditBookApi = {
  async list() {
    return (await api<{ entries: WireEntry[] }>('GET', `${BASE}/entries`, undefined, { auth: true })).entries.map(entry);
  },

  get: (id) => one('GET', `/entries/${encodeURIComponent(id)}`),

  addSale: (input) =>
    one('POST', '/entries', {
      ...('id' in input.customer ? { customer_id: input.customer.id } : { customer: input.customer }),
      amount_cents: input.amountCents,
      description: input.description,
      ...(input.givenOn ? { given_on: input.givenOn } : {}),
      due_on: input.dueOn,
    }),

  recordRepayment: (id, input) => one('POST', `/entries/${encodeURIComponent(id)}/payments`, { amount_cents: input.amountCents, paid_on: input.paidOn }),

  correct: (id, input) =>
    one('POST', `/entries/${encodeURIComponent(id)}/corrections`, {
      amount_cents: input.amountCents,
      due_on: input.dueOn,
      description: input.description,
      reason: input.reason,
    }),

  cancel: (id, reason) => one('POST', `/entries/${encodeURIComponent(id)}/cancel`, { reason }),

  async customers(query) {
    const q = encodeURIComponent(query.trim());
    return (await api<{ customers: WireCustomer[] }>('GET', `${BASE}/customers?q=${q}`, undefined, { auth: true })).customers.map(customer);
  },

  async setCustomerPhone(id, phone) {
    return customer((await api<{ customer: WireCustomer }>('PATCH', `${BASE}/customers/${encodeURIComponent(id)}`, { phone }, { auth: true })).customer);
  },

  async summary() {
    return summary((await api<{ summary: WireSummary }>('GET', `${BASE}/summary`, undefined, { auth: true })).summary);
  },

  async history(query) {
    const q = encodeURIComponent(query.trim());
    return (await api<{ entries: WireEntry[] }>('GET', `${BASE}/history?q=${q}`, undefined, { auth: true })).entries.map(entry);
  },

  async bin() {
    return (await api<{ entries: WireEntry[] }>('GET', `${BASE}/bin`, undefined, { auth: true })).entries.map(entry);
  },

  async moveToBin(id) {
    await api('DELETE', `${BASE}/entries/${encodeURIComponent(id)}`, undefined, { auth: true });
  },

  async restore(id) {
    return entry((await api<{ entry: WireEntry }>('POST', `${BASE}/entries/${encodeURIComponent(id)}/restore`, undefined, { auth: true })).entry);
  },
};
