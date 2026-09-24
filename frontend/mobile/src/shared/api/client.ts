/**
 * The one way the app talks to the Akayza API.
 *
 *  - Speaks the backend's envelope: {success, message, data, code}.
 *    Failures become an ApiError with the server's stable `code`.
 *  - Attaches the access token. When it has expired, refreshes ONCE (even
 *    if several requests fail together) and retries.
 *  - If the session was ended elsewhere (logout, password change, new
 *    phone, stolen token detected), tells the app to sign out.
 *  - Times out instead of hanging on a bad network.
 */
import { API_BASE_URL } from '@/constants/config';

import { clearTokens, getTokens, setTokens } from './tokenStore';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public data?: Record<string, unknown>,
  ) {
    super(message);
  }
}

type Envelope<T> = { success: boolean; message?: string; data?: T; code?: string };

const TIMEOUT_MS = 15000;

let onSessionEnded: (() => void) | null = null;
/** The session provider registers how to sign out when the server says the session is over. */
export function setSessionEndedHandler(handler: (() => void) | null) {
  onSessionEnded = handler;
}

async function raw<T>(method: string, path: string, body?: unknown, token?: string): Promise<{ status: number; json: Envelope<T> }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    let json: Envelope<T>;
    try {
      json = (await res.json()) as Envelope<T>;
    } catch {
      json = { success: false, message: 'Unexpected response from the server.', code: 'BAD_RESPONSE' };
    }
    return { status: res.status, json };
  } catch {
    throw new ApiError(0, 'NETWORK', "Can't reach Akayza. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }
}

let refreshing: Promise<boolean> | null = null;

/** Single-flight refresh: concurrent 401s share one refresh call. */
async function refreshTokens(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      const tokens = await getTokens();
      if (!tokens) return false;
      const { status, json } = await raw<{ access_token: string; refresh_token: string }>('POST', '/auth/refresh', undefined, tokens.refreshToken);
      if (status === 200 && json.data) {
        await setTokens({ accessToken: json.data.access_token, refreshToken: json.data.refresh_token });
        return true;
      }
      return false;
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

/**
 * Call the API. `auth: true` sends the access token and handles expiry.
 * Returns `data` from the envelope; throws ApiError otherwise.
 */
export async function api<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown, opts: { auth?: boolean } = {}): Promise<T> {
  const token = opts.auth ? (await getTokens())?.accessToken : undefined;
  let { status, json } = await raw<T>(method, path, body, token);

  if (opts.auth && status === 401 && json.code === 'TOKEN_EXPIRED') {
    if (await refreshTokens()) {
      ({ status, json } = await raw<T>(method, path, body, (await getTokens())?.accessToken));
    }
  }

  if (opts.auth && status === 401) {
    // Session over (signed out elsewhere, password changed, new phone...).
    await clearTokens();
    onSessionEnded?.();
  }

  if (status >= 200 && status < 300 && json.success) return (json.data ?? {}) as T;
  throw new ApiError(status, json.code ?? 'ERROR', json.message ?? 'Something went wrong. Try again.', (json.data as Record<string, unknown>) ?? undefined);
}
