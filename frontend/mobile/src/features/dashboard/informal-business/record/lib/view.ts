/**
 * What My record shows for one month, worked out from the summary so the
 * rules can be tested without rendering:
 *   - three blocks, NEVER added together (CLAUDE.md "honest proof");
 *   - only the PayFast line is proof; the credit book and jobs say "your
 *     own record" and never "proof";
 *   - the eye hides amounts (counts stay);
 *   - a tool that's off says how to switch it on;
 *   - a month with nothing in it says so.
 */
import type { Evidence } from '@/features/dashboard/informal-business/orders/types';
import { formatRand } from '@/shared/lib/money';

import type { RecordSummary } from '../types';
import { monthName } from './months';

export const HIDDEN = 'R ••••';

export type RecordLine = {
  label: string;
  value: string;
  note?: string;
  strong?: boolean;
  /** Stock lines open My orders showing only these orders. */
  evidence?: Exclude<Evidence, 'none'>;
};
export type RecordBlock = { key: 'orders' | 'creditBook' | 'jobs'; title: string; note?: string; lines: RecordLine[]; off?: string };
export type RecordView = { empty: string | null; blocks: RecordBlock[] };

const count = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

export function recordView(
  r: RecordSummary,
  { tools, hidden, builder = false }: { tools: { creditBook?: boolean; jobs?: boolean }; hidden: boolean; builder?: boolean },
): RecordView {
  const rand = (cents: number) => (hidden ? HIDDEN : formatRand(cents));
  const o = r.orders;
  // Off in the app or on the server: either way there's nothing to show.
  const credit = tools.creditBook ? r.creditBook : null;
  const jobs = tools.jobs ? r.jobs : null;
  const nothing =
    !o.providerVerified.orders &&
    !o.confirmedByBoth.orders &&
    !o.notConfirmed.orders &&
    !credit?.givenCents &&
    !credit?.paidBackCents &&
    !jobs?.confirmedStages &&
    !jobs?.amountsDontMatch;

  return {
    empty: nothing ? `Nothing recorded in ${monthName(r.month)}.` : null,
    blocks: [
      {
        key: 'orders',
        title: builder ? 'Materials you bought' : 'Stock you bought',
        lines: [
          { label: 'Paid in the app, verified by PayFast', value: rand(o.providerVerified.cents), note: count(o.providerVerified.orders, 'order', 'orders'), strong: true, evidence: 'provider_verified' },
          { label: 'Cash, confirmed by both', value: rand(o.confirmedByBoth.cents), note: count(o.confirmedByBoth.orders, 'order', 'orders'), evidence: 'confirmed_by_both' },
          { label: 'Cash, not confirmed', value: rand(o.notConfirmed.cents), note: count(o.notConfirmed.orders, 'order', 'orders'), evidence: 'not_confirmed' },
        ],
      },
      {
        key: 'creditBook',
        title: 'Your credit book',
        note: 'Your own record',
        lines: credit
          ? [
              { label: 'Credit given', value: rand(credit.givenCents) },
              { label: 'Paid back', value: rand(credit.paidBackCents) },
            ]
          : [],
        off: credit ? undefined : 'Switch on Credit book in Account.',
      },
      {
        key: 'jobs',
        title: 'Your jobs',
        note: 'Your own record',
        lines: jobs
          ? [
              { label: 'Stages confirmed by clients', value: rand(jobs.confirmedCents), note: count(jobs.confirmedStages, 'stage', 'stages') },
              { label: "Amounts that don't match", value: String(jobs.amountsDontMatch) },
            ]
          : [],
        off: jobs ? undefined : 'Switch on Jobs in Account.',
      },
    ],
  };
}
