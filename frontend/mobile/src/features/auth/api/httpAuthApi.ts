/**
 * The REAL auth API: the Akayza backend's /api/v1/auth routes.
 * Same shape as mockAuthApi, so screens don't change.
 *
 * Tokens from verify/sign-in go straight into secure storage (tokenStore);
 * screens never see them.
 */
import { PRIVACY_POLICY } from '@/content/legal/privacyPolicy';
import { TERMS_OF_USE } from '@/content/legal/termsOfUse';
import { api, ApiError } from '@/shared/api/client';
import { clearTokens, setTokens } from '@/shared/api/tokenStore';
import { getTrustedToken, phoneInfo, setTrustedToken } from '@/shared/api/trustedPhone';

import { consentNow, emptyProfile } from '../profile';
import { AuthApi, AuthError, Profile } from '../types';

type ServerUser = {
  id: string;
  email: string;
  business_name: string;
  status: string;
  signed_up_with: 'email' | 'google';
};
type SignedIn = { access_token: string; refresh_token: string; user: ServerUser; trusted_phone_token?: string };
type LoginStep = SignedIn | { code_required: true; challenge: string };

/** Turn server failures into AuthErrors with the server's own message. */
async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiError) throw new AuthError(e.code, e.message);
    throw e;
  }
}

async function keep(result: SignedIn): Promise<Profile> {
  await setTokens({ accessToken: result.access_token, refreshToken: result.refresh_token });
  // Given after an email code: this phone skips the code next time.
  await setTrustedToken(result.user.email, result.trusted_phone_token);
  // The server has the account; business details (type, pin, categories)
  // are still kept on the phone until the business-profile API exists.
  return {
    ...emptyProfile,
    email: result.user.email,
    businessName: result.user.business_name,
    signedUpWith: result.user.signed_up_with,
    // Consent was recorded on the server at sign-up.
    consent: consentNow(),
  };
}

export const httpAuthApi: AuthApi = {
  createAccount: (input) =>
    call(async () => {
      await api('POST', '/auth/register', {
        business_name: input.businessName,
        email: input.email,
        password: input.password,
        consent: { privacy_version: PRIVACY_POLICY.version, terms_version: TERMS_OF_USE.version },
      });
    }),

  verifyEmail: (email, code) =>
    call(async () => {
      await keep(await api<SignedIn>('POST', '/auth/verify-email', { email, code, phone: phoneInfo() }));
    }),

  resendCode: (email) =>
    call(async () => {
      await api('POST', '/auth/resend-code', { email });
    }),

  continueWithGoogle: async () => {
    throw new AuthError('GOOGLE_UNAVAILABLE', "Google sign-in isn't available yet. Use your email for now.");
  },

  linkGoogle: async () => {
    throw new AuthError('GOOGLE_UNAVAILABLE', "Google sign-in isn't available yet. Use your email for now.");
  },

  signIn: (email, password) =>
    call(async () => {
      const trusted = await getTrustedToken(email);
      const step = await api<LoginStep>('POST', '/auth/login', {
        email,
        password,
        phone: phoneInfo(),
        ...(trusted ? { trusted_phone_token: trusted } : {}),
      });
      if ('code_required' in step) return { kind: 'code_required' as const, challenge: step.challenge };
      return { kind: 'signed_in' as const, profile: await keep(step) };
    }),

  verifySignIn: (_email, challenge, code) =>
    call(async () => keep(await api<SignedIn>('POST', '/auth/login/verify', { challenge, code, phone: phoneInfo() }))),

  resendSignInCode: (challenge) =>
    call(async () => {
      await api('POST', '/auth/login/resend-code', { challenge });
    }),

  requestPasswordReset: (email) =>
    call(async () => {
      await api('POST', '/auth/forgot-password', { email });
    }),

  resetPassword: (token, password) =>
    call(async () => {
      await api('POST', '/auth/reset-password', { token, password });
    }),

  logout: async () => {
    try {
      await api('POST', '/auth/logout', undefined, { auth: true });
    } catch {
      // Signing out locally must work even offline.
    } finally {
      await clearTokens();
    }
  },
};
