/**
 * api() extra headers: sent, never able to replace the token, and sent
 * again unchanged on the retry after a token refresh (so a retried save
 * keeps its Idempotency-Key).
 */
import { beforeEach, expect, jest, test } from '@jest/globals';

import { api, newIdempotencyKey } from '../client';

let mockTokens: { accessToken: string; refreshToken: string } | null = { accessToken: 'old', refreshToken: 'r1' };
jest.mock('../tokenStore', () => ({
  getTokens: async () => mockTokens,
  setTokens: async (t: typeof mockTokens) => {
    mockTokens = t;
  },
  clearTokens: async () => {
    mockTokens = null;
  },
}));

type Call = { url: string; headers: Record<string, string> };
let calls: Call[] = [];

function respond(status: number, body: object) {
  return Promise.resolve({ status, json: () => Promise.resolve(body) });
}

beforeEach(() => {
  calls = [];
  mockTokens = { accessToken: 'old', refreshToken: 'r1' };
});

test('extra headers are sent and cannot replace the token', async () => {
  global.fetch = jest.fn((url: string, init: { headers: Record<string, string> }) => {
    calls.push({ url, headers: init.headers });
    return respond(201, { success: true, data: { ok: 1 } });
  }) as unknown as typeof fetch;

  await api('POST', '/me/credit-book/entries', { a: 1 }, { auth: true, headers: { 'Idempotency-Key': 'k-1', Authorization: 'Bearer forged' } });

  expect(calls[0].headers['Idempotency-Key']).toBe('k-1');
  expect(calls[0].headers.Authorization).toBe('Bearer old');
});

test('the retry after a token refresh sends the same Idempotency-Key', async () => {
  global.fetch = jest.fn((url: string, init: { headers: Record<string, string> }) => {
    calls.push({ url, headers: init.headers });
    if (url.endsWith('/auth/refresh')) return respond(200, { success: true, data: { access_token: 'new', refresh_token: 'r2' } });
    if (init.headers.Authorization === 'Bearer old') return respond(401, { success: false, code: 'TOKEN_EXPIRED' });
    return respond(201, { success: true, data: { saved: true } });
  }) as unknown as typeof fetch;

  const out = await api<{ saved: boolean }>('POST', '/me/credit-book/entries', { a: 1 }, { auth: true, headers: { 'Idempotency-Key': 'k-2' } });

  const saves = calls.filter((c) => c.url.endsWith('/entries'));
  expect(out.saved).toBe(true);
  expect(saves).toHaveLength(2);
  expect(saves.map((c) => c.headers['Idempotency-Key'])).toEqual(['k-2', 'k-2']);
  expect(saves[1].headers.Authorization).toBe('Bearer new');
});

test('idempotency keys are unique', () => {
  const keys = new Set(Array.from({ length: 1000 }, newIdempotencyKey));
  expect(keys.size).toBe(1000);
});
