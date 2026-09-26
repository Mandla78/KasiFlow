/**
 * My record (docs/plan_v2_integrations/03_ACCOUNT_AND_MY_RECORD.txt): one
 * month of the trader's money in three blocks that are NEVER added
 * together. Only a payment the provider verified is proof; the credit book
 * and jobs are the trader's own record. There is no total, on purpose.
 */
import type { Cents } from '@/shared/lib/money';

export type MoneyCount = { cents: Cents; orders: number };

export type RecordSummary = {
  /** "2026-09" */
  month: string;
  /** The first month that can be shown (the month the account was made). */
  firstMonth: string;
  /** Stock bought, by order date, kept apart by what backs the payment. */
  orders: { providerVerified: MoneyCount; confirmedByBoth: MoneyCount; notConfirmed: MoneyCount };
  /** null: the credit book is switched off. */
  creditBook: { givenCents: Cents; paidBackCents: Cents } | null;
  /** null: jobs are switched off. */
  jobs: { confirmedCents: Cents; confirmedStages: number; amountsDontMatch: number } | null;
};

/**
 * A record seal exactly as the server made it (proof/integrity): the
 * fingerprints of every record in the tools, signed with Ed25519 and
 * ML-DSA-65. The app keeps it and sends it back untouched; it holds only
 * kinds, ids and fingerprints -- no names, amounts or text.
 */
export type RecordSeal = {
  v: number;
  alg: string[];
  business: string;
  sealed_at: string;
  count: number;
  root: string;
  leaves: [string, string, string][];
  sig: { ed25519: string; ml_dsa_65: string | null };
  key_ids: { ed25519: string; ml_dsa_65: string | null };
  /** Made by the mock API: nothing was signed. */
  mock?: boolean;
};

/** A sealed record that changed or went missing: what it is and its day. */
export type SealItem = { kind: string; id: string; on: string | null };

/** "valid", "invalid", "absent" (not in the seal) or "unavailable" (not checkable here). */
export type SignatureState = string;

export type SealCheck = {
  intact: boolean;
  signatures: { ed25519: SignatureState; mlDsa65: SignatureState };
  sealedAt: string;
  sealed: number;
  unchanged: number;
  changed: SealItem[];
  missing: SealItem[];
  addedSince: number;
};

export interface RecordApi {
  /** month "YYYY-MM"; none = this month. */
  summary(month?: string): Promise<RecordSummary>;
  /** Seal every record in my tools now; the seal is mine to keep. */
  seal(): Promise<RecordSeal>;
  /** Has anything I sealed changed since? Throws if the seal was altered. */
  check(seal: RecordSeal): Promise<SealCheck>;
}
