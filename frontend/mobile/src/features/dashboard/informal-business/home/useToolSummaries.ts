/**
 * The live numbers Home and Account show, from each tool's own summary:
 * the credit book (who owes you) and jobs (what's waiting on clients).
 * Each loads and fails on its own, so one tool being down never blanks
 * the other; only tools that are switched on are asked; both refresh
 * whenever the screen comes back into view.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useSession } from '@/features/auth/session/SessionProvider';
import { creditBookApi } from '@/features/dashboard/informal-business/credit-book/api/creditBookApi';
import { CreditSummary } from '@/features/dashboard/informal-business/credit-book/types';
import { jobsApi } from '@/features/dashboard/informal-business/jobs/api/jobsApi';
import { JobsSummary } from '@/features/dashboard/informal-business/jobs/types';

export type Loaded<T> = { state: 'off' } | { state: 'loading' } | { state: 'failed' } | { state: 'ready'; data: T };

export function useToolSummaries(): { credit: Loaded<CreditSummary>; jobs: Loaded<JobsSummary>; reload: () => void } {
  const { profile } = useSession();
  const creditOn = profile.tools.creditBook;
  const jobsOn = profile.tools.jobs;
  const [credit, setCredit] = useState<Loaded<CreditSummary>>({ state: creditOn ? 'loading' : 'off' });
  const [jobs, setJobs] = useState<Loaded<JobsSummary>>({ state: jobsOn ? 'loading' : 'off' });

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
    return () => {
      live = false;
    };
  }, [creditOn, jobsOn]);
  useFocusEffect(load);

  return { credit, jobs, reload: load };
}
