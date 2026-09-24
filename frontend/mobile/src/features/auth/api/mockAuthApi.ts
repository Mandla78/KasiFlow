/**
 * MOCK auth: nothing leaves the phone. Used until the identity backend is
 * wired; then httpAuthApi.ts implements the same AuthApi and authApi.ts
 * switches to it. Screens don't change.
 *
 * Mock rules (so the flows can be demoed):
 *  - any 6-digit code verifies, except 000000 (shows the error state)
 *  - ndlamini.work@gmail.com is "already registered", so picking it on the
 *    Google sheet shows the link-Google screen
 *  - sign in works for any email with an 8+ character password
 */
import { isStrongPassword } from '@/shared/lib/validation';

import { demoProfile } from '../profile';
import { AuthApi, AuthError } from '../types';

const ALREADY_REGISTERED = ['ndlamini.work@gmail.com'];

const wait = (ms = 600) => new Promise((resolve) => setTimeout(resolve, ms));

export const mockAuthApi: AuthApi = {
  async createAccount(input) {
    await wait();
    // The server re-checks the password rule: the app's check can be bypassed.
    if (!isStrongPassword(input.password)) {
      throw new AuthError('WEAK_PASSWORD', 'Choose a stronger password: see the list under the password field.');
    }
    if (ALREADY_REGISTERED.includes(input.email.toLowerCase())) {
      throw new AuthError('EMAIL_TAKEN', 'That email already has an account. Sign in instead.');
    }
  },

  async verifyEmail(_email, code) {
    await wait();
    if (code === '000000') {
      throw new AuthError('INVALID_CODE', "That code doesn't match. Check the latest email.");
    }
  },

  async resendCode() {
    await wait(300);
  },

  async continueWithGoogle(email) {
    await wait(400);
    return ALREADY_REGISTERED.includes(email.toLowerCase()) ? 'link' : 'new';
  },

  async linkGoogle(email, password) {
    await wait();
    if (password.length < 8) {
      throw new AuthError('INVALID_CREDENTIALS', "That password doesn't match this account.");
    }
    return demoProfile(email, 'google');
  },

  async signIn(email, password) {
    await wait();
    if (!email.includes('@') || password.length < 8) {
      throw new AuthError('INVALID_CREDENTIALS', "That email and password don't match.");
    }
    return demoProfile(email, 'email');
  },

  async requestPasswordReset() {
    await wait();
  },
};
