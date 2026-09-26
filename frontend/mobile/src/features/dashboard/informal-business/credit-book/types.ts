/**
 * The credit book as the app sees it: customers who owe the trader.
 * Field names are the camelCase twins of the API
 * (docs/teammate/feedback/CONTRACT_credit_book.txt); httpCreditBookApi
 * maps snake_case on the wire, screens never see it.
 *
 * Customers only: money owed to suppliers comes from real orders, on the
 * orders side (docs/teammate/feedback/DECISION_credit_book.txt).
 *
 * Money is integer cents. Dates are ISO calendar days ("2026-09-25") in
 * the trader's own day; timestamps are full ISO strings.
 */
import { Cents } from '@/shared/lib/money';

/** cancelled = entered by mistake. The entry stays in history; it just stops counting. */
export type EntryStatus = 'open' | 'paid' | 'cancelled';

export type Customer = {
  id: string;
  /** Whatever the trader calls them; a nickname is fine. */
  name: string;
  /** Digits only, 0XXXXXXXXX. Only used to open WhatsApp on the trader's phone. */
  phone: string | null;
  /** What this customer still owes across open entries. */
  owesCents: Cents;
};

export type CreditEntry = {
  id: string;
  customer: { id: string; name: string; phone: string | null };
  /** The amount after any corrections. */
  amountCents: Cents;
  paidCents: Cents;
  outstandingCents: Cents;
  description: string;
  givenOn: string;
  dueOn: string;
  status: EntryStatus;
  createdAt: string;
  /** When the trader moved it to the bin (hidden from them, never deleted); null otherwise. */
  binnedAt: string | null;
};

type Recorded = { id: string; on: string; recordedAt: string };

/** One line of an entry's history. Append-only: nothing here is ever edited. */
export type HistoryItem =
  | (Recorded & { type: 'given'; amountCents: Cents })
  | (Recorded & { type: 'repayment'; amountCents: Cents })
  | (Recorded & { type: 'correction'; before: Corrected; after: Corrected; reason: string })
  | (Recorded & { type: 'cancelled'; reason: string });

export type Corrected = { amountCents: Cents; dueOn: string; description: string };

export type CreditEntryDetail = CreditEntry & { history: HistoryItem[] };

/** An existing customer by id, or a new one typed in the form. */
export type CustomerRef = { id: string } | { name: string; phone: string | null };

export type NewCreditSale = {
  customer: CustomerRef;
  amountCents: Cents;
  description: string;
  /** Copying the paper book: when it was given (up to a year back). Today when left out. */
  givenOn?: string;
  dueOn: string;
};

export type NewRepayment = { amountCents: Cents; paidOn: string };

/** A correction replaces the current values; the old ones stay in history. */
export type Correction = Corrected & { reason: string };

/** Totals for Home and the Account tile. */
export type CreditSummary = {
  customersOweCents: Cents;
  /** Customers with something still open. */
  customersOwing: number;
  dueTodayCount: number;
  dueTodayCents: Cents;
  overdueCount: number;
  /** This calendar month: new credit given, and repayments received. */
  givenThisMonthCents: Cents;
  paidBackThisMonthCents: Cents;
};

/** Everything the credit book asks of the server. Mock or HTTP (creditBookApi.ts). */
export interface CreditBookApi {
  /** Open and paid entries (cancelled ones only show in history). */
  list(): Promise<CreditEntry[]>;
  get(id: string): Promise<CreditEntryDetail>;
  /** key: an Idempotency-Key, so a retry (even days later, from the phone's queue) lands once. */
  addSale(input: NewCreditSale, key?: string): Promise<CreditEntryDetail>;
  recordRepayment(id: string, input: NewRepayment, key?: string): Promise<CreditEntryDetail>;
  correct(id: string, input: Correction): Promise<CreditEntryDetail>;
  cancel(id: string, reason: string): Promise<CreditEntryDetail>;
  /** The trader's customers, best match first; empty query = everyone. */
  customers(query: string): Promise<Customer[]>;
  /** Set (or clear, with null) a customer's cellphone, for WhatsApp. */
  setCustomerPhone(id: string, phone: string | null): Promise<Customer>;
  summary(): Promise<CreditSummary>;
  /** Finished entries (paid back, cancelled), newest first; q searches the customer's name. */
  history(query: string): Promise<CreditEntry[]>;
  /**
   * The bin: entries the trader deleted in the last 30 days. Deleting
   * only HIDES an entry from the trader (lists, Home, Account, totals);
   * it and its payments stay in the database and in their record.
   */
  bin(): Promise<CreditEntry[]>;
  moveToBin(id: string): Promise<void>;
  restore(id: string): Promise<CreditEntry>;
}

/** Items stay visible in the bin for this long; then only hidden from view, never removed. */
export const BIN_DAYS = 30;
