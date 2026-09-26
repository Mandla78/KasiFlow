/**
 * Saving one part of the business profile from Business profile (edit
 * mode), and WAITING for the server's answer -- unlike the quiet
 * background sync used during sign-up. The trader sees "Saving…", then
 * either their change, saved, or the server's reason it wasn't.
 *
 * Only the sections that screen changed are sent, so a problem in another
 * section can't block this save. The session is then set from the
 * server's answer, not from what we sent.
 */
import { useCallback, useState } from 'react';
import { Platform, ToastAndroid } from 'react-native';

import { USE_MOCK_AUTH } from '@/constants/config';
import { useSession } from '@/features/auth/session/SessionProvider';
import type { Profile } from '@/features/auth/types';
import { ApiError } from '@/shared/api/client';

import { businessProfileApi, fromServer, Section, toServer } from '../api/businessProfileApi';

/** The first field message in the server's 422 errors, e.g. "Business name: letters only". */
export function firstFieldError(errors: unknown): string | null {
  const walk = (v: unknown): string | null => {
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) {
      for (const x of v) {
        const found = walk(x);
        if (found) return found;
      }
      return null;
    }
    if (v && typeof v === 'object') {
      for (const x of Object.values(v)) {
        const found = walk(x);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(errors);
}

/** What to tell the trader when a save failed. */
export function saveErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return "Couldn't save. Check your connection and try again.";
    if (e.status === 422) return firstFieldError(e.errors) ?? e.message;
    if (e.status === 429) return 'Too many changes at once. Wait a minute and try again.';
    if (e.status >= 400 && e.status < 500) return e.message;
  }
  return "Couldn't save. Try again in a moment.";
}

export function savedToast(what = 'Saved') {
  if (Platform.OS === 'android') ToastAndroid.show(what, ToastAndroid.SHORT);
}

export function useSectionSave() {
  const { profile, updateProfile } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  /** Saves `change` (only `sections` are sent). Resolves true when the server kept it. */
  const save = useCallback(
    async (change: Partial<Profile>, sections: Section[]): Promise<boolean> => {
      setError('');
      if (USE_MOCK_AUTH) {
        // Sample data: nothing to save to; the phone keeps it.
        updateProfile(change);
        return true;
      }
      const all = toServer({ ...profile, ...change });
      const body = Object.fromEntries(sections.map((s) => [s, all[s]]));
      setBusy(true);
      try {
        const saved = await businessProfileApi.save(body);
        updateProfile(fromServer(saved));
        return true;
      } catch (e) {
        setError(saveErrorMessage(e));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [profile, updateProfile],
  );

  return { save, busy, error };
}
