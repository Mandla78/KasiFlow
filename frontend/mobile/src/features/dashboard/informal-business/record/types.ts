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

export interface RecordApi {
  /** month "YYYY-MM"; none = this month. */
  summary(month?: string): Promise<RecordSummary>;
}
