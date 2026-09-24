/**
 * Where the user is in the journey, and what they've told us so far.
 *
 *   signedOut  -> landing, create account, sign in, reset
 *   unverified -> account created, waiting for the email code
 *   onboarding -> email confirmed (or Google): business, location, buying
 *   active     -> the dashboard
 *
 * The root layout guards each route group on `status`, so moving between
 * stages is just a state change; the router redirects on its own.
 *
 * Saved in SecureStore so a reload keeps you where you were.
 */
import * as SecureStore from 'expo-secure-store';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import { BUSINESS_TYPES, BusinessType, defaultCategories, ToolKey, TradeKey } from '@/constants/businessTypes';

import { setSessionEndedHandler } from '@/shared/api/client';

import { authApi } from '../api/authApi';
import { consentNow, emptyProfile } from '../profile';
import { CipcStatus, Profile } from '../types';

export type Status = 'signedOut' | 'unverified' | 'onboarding' | 'active';

export type SessionState = { status: Status; profile: Profile };

// Bump when Profile's shape changes, so an old saved session is dropped
// instead of crashing a screen that expects the new fields.
const STORAGE_KEY = 'akayza.session.v4';

const initialState: SessionState = { status: 'signedOut', profile: emptyProfile };

// The last profile on this phone, so signing back in restores onboarding
// answers (they live on the phone until the business-profile API exists).
const LAST_PROFILE_KEY = 'akayza.lastProfile.v1';

async function loadLastProfile(): Promise<Profile | null> {
  try {
    const raw = await SecureStore.getItemAsync(LAST_PROFILE_KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

async function saveLastProfile(profile: Profile) {
  try {
    await SecureStore.setItemAsync(LAST_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // not fatal
  }
}

/** Has this account finished onboarding (type, pin, what they buy)? */
function isOnboarded(p: Profile): boolean {
  return !!p.businessType && !!p.location && p.categories.length > 0;
}

type SessionContextValue = SessionState & {
  loaded: boolean;
  startEmailSignUp: (businessName: string, email: string) => void;
  emailVerified: () => void;
  startGoogleSignUp: (email: string, ownerName: string, consented: boolean) => void;
  acceptConsent: () => void;
  updateProfile: (patch: Partial<Profile>) => void;
  setBusinessType: (type: BusinessType) => void;
  setTrade: (trade: TradeKey) => void;
  setTool: (tool: ToolKey, on: boolean) => void;
  /** The backend's CIPC answer arrived (ignored if the number changed meanwhile). */
  setCipcResult: (number: string, result: { status: CipcStatus; registeredName?: string; checkedAt: string }) => void;
  finishOnboarding: () => void;
  signedIn: (profile: Profile) => void;
  signOut: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

async function load(): Promise<SessionState | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SessionState) : null;
  } catch {
    return null;
  }
}

async function save(state: SessionState) {
  try {
    if (state.status === 'signedOut') await SecureStore.deleteItemAsync(STORAGE_KEY);
    else await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Not fatal: the session just won't survive a reload.
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(initialState);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    load().then((saved) => {
      if (saved) setState(saved);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) save(state);
    if (loaded && state.status === 'active') saveLastProfile(state.profile);
  }, [state, loaded]);

  // The server ended this session (signed out elsewhere, password changed,
  // new phone): go back to the landing screen.
  useEffect(() => {
    setSessionEndedHandler(() => setState(initialState));
    return () => setSessionEndedHandler(null);
  }, []);

  const value = useMemo<SessionContextValue>(() => {
    const patch = (p: Partial<Profile>, status?: Status) =>
      setState((s) => ({ status: status ?? s.status, profile: { ...s.profile, ...p } }));

    return {
      ...state,
      loaded,
      // Consent was ticked on the create-account screen, so stamp it here.
      startEmailSignUp: (businessName, email) =>
        setState({ status: 'unverified', profile: { ...emptyProfile, businessName, email, consent: consentNow() } }),
      emailVerified: () => patch({}, 'onboarding'),
      startGoogleSignUp: (email, ownerName, consented) =>
        setState({
          status: 'onboarding',
          profile: { ...emptyProfile, email, ownerName, signedUpWith: 'google', consent: consented ? consentNow() : null },
        }),
      acceptConsent: () => patch({ consent: consentNow() }),
      updateProfile: (p) => patch(p),
      // Choosing a type resets the defaults it drives: tools and categories.
      setBusinessType: (businessType) =>
        setState((s) => ({
          ...s,
          profile: {
            ...s.profile,
            businessType,
            trade: businessType === 'builder' ? s.profile.trade : null,
            tools: BUSINESS_TYPES[businessType].tools,
            categories: defaultCategories(businessType, businessType === 'builder' ? s.profile.trade : null),
          },
        })),
      setTrade: (trade) =>
        setState((s) => ({ ...s, profile: { ...s.profile, trade, categories: defaultCategories('builder', trade) } })),
      setTool: (tool, on) =>
        setState((s) => ({
          ...s,
          // My record is always on: it's the proof everything else writes to.
          profile: { ...s.profile, tools: { ...s.profile.tools, [tool]: tool === 'myRecord' ? true : on } },
        })),
      setCipcResult: (number, result) =>
        setState((s) => {
          const cipc = s.profile.registration.cipc;
          if (!cipc || cipc.number !== number) return s;
          return { ...s, profile: { ...s.profile, registration: { ...s.profile.registration, cipc: { number, ...result } } } };
        }),
      finishOnboarding: () => patch({}, 'active'),
      signedIn: (profile) => {
        // Same account on this phone before? Restore its onboarding answers.
        loadLastProfile().then((last) => {
          const merged = last && last.email === profile.email ? { ...last, ...pickServerFields(profile) } : profile;
          setState({ status: isOnboarded(merged) ? 'active' : 'onboarding', profile: merged });
        });
      },
      signOut: () => {
        authApi.logout(); // ends the session on the server; local sign-out never waits for it
        setState(initialState);
      },
    };
  }, [state, loaded]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** What the server is the source of truth for. */
function pickServerFields(p: Profile): Partial<Profile> {
  return { email: p.email, businessName: p.businessName, signedUpWith: p.signedUpWith, consent: p.consent };
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
