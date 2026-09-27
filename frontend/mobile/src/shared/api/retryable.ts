/**
 * Should a write saved on the phone wait and try again, or is the server's
 * "no" final? Worth waiting for:
 *   - no connection or a timeout: the API client throws ApiError(0,
 *     'NETWORK') -- that is the normal "no signal" case, never a refusal;
 *   - a server hiccup (5xx) or "slow down" (429);
 *   - the session ended (401): after signing in again it can still go.
 * Anything else (400, 404, 409, 422...) is a real refusal.
 */
import { ApiError } from './client';

export function isRetryable(err: unknown): boolean {
  return !(err instanceof ApiError) || err.status === 0 || err.status === 401 || err.status === 429 || err.status >= 500;
}
