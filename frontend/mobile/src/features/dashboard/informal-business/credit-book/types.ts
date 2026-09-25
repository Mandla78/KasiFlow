/**
 * The credit book as the app sees it. Field names are the camelCase twins
 * of the API contract (docs/teammate/feedback/CONTRACT_credit_book.txt);
 * the http layer maps snake_case on the wire, screens never see it.
 *
 * Money is integer cents. Dates are ISO calendar days ("2026-09-25") in
 * the trader's own day; timestamps are full ISO strings.
 */
import { Cents } from '@/shared/lib/money';

/** customer_debt: a customer owes the trader. supplier_debt: the trader owes a supplier. */
export type CreditKind = 'customer_debt' | 'supplier_debt';

/** cancelled = entered by mistake. The entry stays in history; it just stops counting. */
export type EntryStatus = 'open' | 'paid' | 'cancelled';

/** Who put the entry in the book: the trader by hand, or (later) a real order. */
export type EntrySource = 'trader' | 'order';

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
  kind: CreditKind;
  source: EntrySource;
  /** customer_debt only. */
  customer: { id: string; name: string; phone: string | null } | null;
  /** supplier_debt only. */
  supplierName: string | null;
  /** The amount after any corrections. */
  amountCents: Cents;
  paidCents: Cents;
  outstandingCents: Cents;
  description: string;
  givenOn: string;
  dueOn: string;
  status: EntryStatus;
  createdAt: string;
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
  dueOn: string;
};

export type NewSupplierDebt = {
  supplierName: string;
  amountCents: Cents;
  description: string;
  dueOn: string;
};

export type NewRepayment = { amountCents: Cents; paidOn: string };

/** A correction replaces the current values; the old ones stay in history. */
export type Correction = Corrected & { reason: string };

/** Totals for the header, the Home tab and the Account tile. */
export type CreditSummary = {
  customersOweCents: Cents;
  /** Customers with something still open. */
  customersOwing: number;
  dueTodayCount: number;
  dueTodayCents: Cents;
  overdueCount: number;
  youOweSuppliersCents: Cents;
  /** This calendar month: new credit given to customers, and repayments from them. */
  givenThisMonthCents: Cents;
  paidBackThisMonthCents: Cents;
};

/** Everything the credit book asks of the server. Mock today, HTTP after the contract is approved. */
export interface CreditBookApi {
  /** Open and paid entries of one kind (cancelled ones only show in history). */
  list(kind: CreditKind): Promise<CreditEntry[]>;
  get(id: string): Promise<CreditEntryDetail>;
  addSale(input: NewCreditSale): Promise<CreditEntryDetail>;
  addSupplierDebt(input: NewSupplierDebt): Promise<CreditEntryDetail>;
  recordRepayment(id: string, input: NewRepayment): Promise<CreditEntryDetail>;
  correct(id: string, input: Correction): Promise<CreditEntryDetail>;
  cancel(id: string, reason: string): Promise<CreditEntryDetail>;
  /** The trader's customers, best match first; empty query = everyone. */
  customers(query: string): Promise<Customer[]>;
  summary(): Promise<CreditSummary>;
  /**
   * SEAM (docs/teammate/01, c): supplier debts that come from real orders
   * (stock given on credit). Orders are Mandla's; this returns [] until
   * they exist. Entries from here have source 'order'.
   */
  suppliersOwedFromOrders(): Promise<CreditEntry[]>;
}
