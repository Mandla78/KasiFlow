/**
 * Account security (More -> Security): the signed-in user's own sessions,
 * password, data and account. Mock and HTTP behind one interface; the
 * backend scopes everything to the token, never to an id from the app.
 */
import { USE_MOCK_AUTH } from '@/constants/config';
import { api, ApiError } from '@/shared/api/client';

import { AuthError } from '../../types';

export type SignedInPhone = {
  id: string;
  this_phone: boolean;
  signed_in_at: string;
  last_used_at: string;
  platform: string | null;
  label: string | null;
};

export interface SecurityApi {
  phones(): Promise<SignedInPhone[]>;
  signOutOthers(): Promise<number>;
  changePassword(current: string, next: string): Promise<number>;
  exportData(): Promise<Record<string, unknown>>;
  closeAccount(password: string): Promise<void>;
}

async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiError) throw new AuthError(e.code, e.message);
    throw e;
  }
}

const http: SecurityApi = {
  phones: () => call(async () => (await api<{ sessions: SignedInPhone[] }>('GET', '/auth/sessions', undefined, { auth: true })).sessions),
  signOutOthers: () => call(async () => (await api<{ signed_out: number }>('POST', '/auth/logout-others', undefined, { auth: true })).signed_out),
  changePassword: (current, next) =>
    call(async () => (await api<{ signed_out: number }>('POST', '/auth/change-password', { current_password: current, new_password: next }, { auth: true })).signed_out),
  exportData: () => call(() => api<Record<string, unknown>>('GET', '/me/export', undefined, { auth: true })),
  closeAccount: (password) =>
    call(async () => {
      await api('POST', '/me/close-account', { password }, { auth: true });
    }),
};

// Mock: one extra phone signed in, any 8+ character password accepted.
const wait = (ms = 500) => new Promise((r) => setTimeout(r, ms));
let otherPhones = 1;
const mock: SecurityApi = {
  async phones() {
    await wait();
    const now = new Date().toISOString();
    return [
      { id: 'this', this_phone: true, signed_in_at: now, last_used_at: now, platform: 'android', label: 'This phone' },
      ...Array.from({ length: otherPhones }, (_, i) => ({
        id: `other-${i}`, this_phone: false, signed_in_at: now, last_used_at: now, platform: 'android', label: 'Samsung A14',
      })),
    ];
  },
  async signOutOthers() {
    await wait();
    const n = otherPhones;
    otherPhones = 0;
    return n;
  },
  async changePassword(current) {
    await wait();
    if (current.length < 8) throw new AuthError('WRONG_PASSWORD', 'That password is incorrect.');
    const n = otherPhones;
    otherPhones = 0;
    return n;
  },
  async exportData() {
    await wait();
    return { account: { note: 'Sample data (mock mode)' } };
  },
  async closeAccount(password) {
    await wait();
    if (password.length < 8) throw new AuthError('WRONG_PASSWORD', 'That password is incorrect.');
  },
};

export const securityApi: SecurityApi = USE_MOCK_AUTH ? mock : http;
