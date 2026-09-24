/**
 * The sign-in waiting for its email code (two-factor). Held in memory only,
 * never in the URL or storage: the challenge ties the code to this phone.
 */
export type PendingSignIn = { email: string; challenge: string };

let pending: PendingSignIn | null = null;

export function setPendingSignIn(p: PendingSignIn | null) {
  pending = p;
}

export function getPendingSignIn(): PendingSignIn | null {
  return pending;
}
