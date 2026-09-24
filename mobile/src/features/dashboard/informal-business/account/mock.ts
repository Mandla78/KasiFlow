/**
 * Sample data for the Account tab, shaped like the UX design. Replaced when the
 * backend endpoint lands. All money in cents.
 */
import { Cents } from '@/shared/lib/money';

export const accountMonth = { stockBought: 987000 as Cents, creditGiven: 126000 as Cents, paidBack: 92000 as Cents };

/** The live line under each tool tile. */
export const toolLines = { owedToYou: 34000 as Cents, stockOnItsWay: 1, activeJobs: 2, ordersThisMonth: 12, recordConfirmed: 38, recordTotal: 41 };
