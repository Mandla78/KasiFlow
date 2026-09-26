/**
 * Keeps the phone's business profile and the server's in step.
 *
 *  1. After sign-in (or app start while signed in): read the server's
 *     profile and apply it. A new phone gets its answers back.
 *  2. Every change is saved, one quiet request after the edits settle:
 *     each onboarding step as it's done (so leaving half-way loses
 *     nothing), then edits from Business profile and switched tools.
 *
 * Nothing is saved before step 1 has finished for THIS account, so an
 * empty profile on a fresh phone can never overwrite what the server
 * holds. Mock mode: off.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { USE_MOCK_AUTH } from '@/constants/config';
import { useSession } from '@/features/auth/session/SessionProvider';

import { businessProfileApi, fromServer, toServer } from '../api/businessProfileApi';

const SETTLE_MS = 700;

// Whether the last quiet save failed, so Business profile can say so
// instead of looking saved. `retries` bumps to send it again.
let failed = false;
let retries = 0;
const listeners = new Set<() => void>();
const setFailed = (v: boolean) => {
  if (failed === v) return;
  failed = v;
  listeners.forEach((l) => l());
};
let retryNow: () => void = () => {};

/** True while a change is kept on the phone because the server didn't take it. */
export function useProfileUnsaved(): { unsaved: boolean; retry: () => void } {
  const unsaved = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => failed,
    () => failed,
  );
  return { unsaved, retry: () => retryNow() };
}

export function useBusinessProfileSync() {
  const { loaded, status, profile, applyServerProfile, updateProfile } = useSession();
  const signedIn = status === 'onboarding' || status === 'active';
  const email = profile.email;

  // Which account's server copy has been read (null = none yet).
  const [fetchedFor, setFetchedFor] = useState<string | null>(null);
  const fetched = signedIn && !!email && fetchedFor === email;
  const lastSent = useRef<string | null>(null);
  const [retry, setRetry] = useState(retries);
  useEffect(() => {
    retryNow = () => setRetry(++retries);
    return () => {
      retryNow = () => {};
    };
  }, []);

  // Session actions are re-created on every change; the read below only
  // needs the latest one, not to re-run for it.
  const apply = useRef(applyServerProfile);
  useEffect(() => {
    apply.current = applyServerProfile;
  });

  // 1. Read the server's copy once per signed-in account.
  useEffect(() => {
    if (USE_MOCK_AUTH || !loaded || !signedIn || !email || fetchedFor === email) return;
    businessProfileApi
      .get()
      .then((server) => {
        // Ignored by the session if the user signed out meanwhile.
        if (server) apply.current(fromServer(server), server.onboarded);
        lastSent.current = null;
        setFetchedFor(email);
      })
      .catch(() => {
        // Offline: tried again on the next status change.
      });
  }, [loaded, signedIn, email, fetchedFor]);

  // 2. Save changes (during onboarding too).
  const payload = JSON.stringify(toServer(profile));
  const registration = JSON.stringify(profile.registration);
  useEffect(() => {
    if (USE_MOCK_AUTH || !signedIn || !fetched || payload === lastSent.current) return;
    const t = setTimeout(() => {
      businessProfileApi
        .save(JSON.parse(payload))
        .then((saved) => {
          lastSent.current = payload;
          setFailed(false);
          // The server's CIPC answer is the truth (the app can't set it).
          const fresh = fromServer(saved).registration;
          if (fresh && JSON.stringify(fresh) !== registration) updateProfile({ registration: fresh });
        })
        .catch(() => {
          // Kept on the phone; the next change (or "try again") retries.
          setFailed(true);
        });
    }, SETTLE_MS);
    return () => clearTimeout(t);
  }, [signedIn, fetched, payload, registration, updateProfile, retry]);
}
