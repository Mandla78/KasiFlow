/**
 * The Home tab's "Today" list from the trader's own tools: who pays
 * today or is late (credit book), and which job stages need the builder
 * (jobs). Only what needs attention, most urgent first, a few at a time.
 */
import { Feather } from '@expo/vector-icons';
import { Href } from 'expo-router';
import { ComponentProps } from 'react';

import { daysBetween } from '@/features/dashboard/informal-business/credit-book/lib/dueDates';
import { CreditEntry } from '@/features/dashboard/informal-business/credit-book/types';
import { Job } from '@/features/dashboard/informal-business/jobs/types';
import { Cents } from '@/shared/lib/money';

export type TodayItem = {
  id: string;
  icon: ComponentProps<typeof Feather>['name'];
  tint: 'marigold' | 'info' | 'jade';
  title: string;
  subtitle: string;
  amount?: Cents;
  tag?: { label: string; tone: 'marigold' | 'jade' | 'info' };
  href?: Href;
  /** Not the trader's own data yet (orders are Mandla's): shown with a "Sample" mark. */
  sample?: boolean;
};

export const TODAY_LIMIT = 3;

/** Late first (the latest first), then due today. */
export function creditToday(entries: CreditEntry[], today: string): TodayItem[] {
  return entries
    .filter((e) => e.status === 'open' && e.dueOn <= today)
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn))
    .slice(0, TODAY_LIMIT)
    .map((e) => {
      const late = -daysBetween(today, e.dueOn);
      const name = e.customer.name;
      return {
        id: `credit-${e.id}`,
        icon: 'book',
        tint: late > 0 ? 'marigold' : 'info',
        title: late > 0 ? `${name} is ${late === 1 ? '1 day' : `${late} days`} late` : `${name} pays today`,
        subtitle: ['Credit book', e.description].filter(Boolean).join(' · '),
        amount: e.outstandingCents,
        href: { pathname: '/informal-business/credit-book/[id]', params: { id: e.id } },
      };
    });
}

const JOB_ORDER = { amounts_dont_match: 0, photo_taken: 1, waiting: 2 } as const;

/** Disputes first, then photos waiting to be sent for sign-off, then stages waiting on the client. */
export function jobsToday(jobs: Job[]): TodayItem[] {
  return jobs
    .filter((j) => j.status === 'active')
    .flatMap((j) =>
      j.stages
        .filter((s): s is typeof s & { status: keyof typeof JOB_ORDER } => s.status in JOB_ORDER)
        .map((s) => ({ job: j, stage: s })),
    )
    .sort((a, b) => JOB_ORDER[a.stage.status] - JOB_ORDER[b.stage.status])
    .slice(0, TODAY_LIMIT)
    .map(({ job, stage }) => {
      const href: Href = { pathname: '/informal-business/jobs/[id]', params: { id: job.id } };
      const base = { id: `job-${stage.id}`, icon: 'tool' as const, title: `${job.clientName} ${job.title.toLowerCase()}`, href };
      if (stage.status === 'amounts_dont_match') {
        return { ...base, tint: 'marigold' as const, subtitle: `${stage.name} · amounts don't match`, tag: { label: 'Talk to client', tone: 'marigold' as const } };
      }
      if (stage.status === 'photo_taken') {
        return { ...base, tint: 'info' as const, subtitle: `${stage.name} · photo taken`, tag: { label: 'Send sign-off', tone: 'marigold' as const } };
      }
      return { ...base, tint: 'info' as const, subtitle: `${stage.name} · waiting for client`, amount: stage.amountCents };
    });
}
