/**
 * The live numbers Home and Account show, from each tool's own summary:
 * the credit book (who owes you), jobs (what's waiting on clients) and the
 * order book (orders today, from the server's list of the day).
 * Each loads and fails on its own, so one tool being down never blanks
 * the other; only tools that are switched on are asked; both refresh
 * whenever the screen comes back into view.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useSession } from '@/features/auth/session/SessionProvider';
import { creditBookApi } from '@/features/dashboard/informal-business/credit-book/api/creditBookApi';
import { todayIso } from '@/features/dashboard/informal-business/credit-book/lib/dueDates';
import { CreditSummary } from '@/features/dashboard/informal-business/credit-book/types';
import { jobsApi } from '@/features/dashboard/informal-business/jobs/api/jobsApi';
import { JobsSummary } from '@/features/dashboard/informal-business/jobs/types';
import { orderBookApi } from '@/features/dashboard/informal-business/order-book/api/orderBookApi';

export type Loaded<T> = { state: 'off' } | { state: 'loading' } | { state: 'failed' } | { state: 'ready'; data: T };

/** Orders the server has for today (not cancelled). */
export type OrdersToday = { ordersToday: number };

export function useToolSummaries(): { credit: Loaded<CreditSummary>; jobs: Loaded<JobsSummary>; orders: Loaded<OrdersToday>; reload: () => void } {
  const { profile } = useSession();
  const creditOn = profile.tools.creditBook;
  const jobsOn = profile.tools.jobs;
  const ordersOn = !!profile.tools.orderBook;
  const [credit, setCredit] = useState<Loaded<CreditSummary>>({ state: creditOn ? 'loading' : 'off' });
  const [jobs, setJobs] = useState<Loaded<JobsSummary>>({ state: jobsOn ? 'loading' : 'off' });
  const [orders, setOrders] = useState<Loaded<OrdersToday>>({ state: ordersOn ? 'loading' : 'off' });

  const load = useCallback(() => {
    let live = true;
    if (creditOn) {
      creditBookApi
        .summary()
        .then((data) => live && setCredit({ state: 'ready', data }))
        .catch(() => live && setCredit({ state: 'failed' }));
    } else {
      setCredit({ state: 'off' });
    }
    if (jobsOn) {
      jobsApi
        .summary()
        .then((data) => live && setJobs({ state: 'ready', data }))
        .catch(() => live && setJobs({ state: 'failed' }));
    } else {
      setJobs({ state: 'off' });
    }
    if (ordersOn) {
      orderBookApi
        .orders(todayIso())
        .then((list) => live && setOrders({ state: 'ready', data: { ordersToday: list.filter((o) => o.status !== 'cancelled').length } }))
        .catch(() => live && setOrders({ state: 'failed' }));
    } else {
      setOrders({ state: 'off' });
    }
    return () => {
      live = false;
    };
  }, [creditOn, jobsOn, ordersOn]);
  useFocusEffect(load);

  return { credit, jobs, orders, reload: load };
}
