/** Friendly checks before we ask the server. The server checks again. */

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/**
 * THE PASSWORD RULE, identical to the backend's
 * validate_password_complexity (backend/src/shared/security/security.py).
 * The server must never be more permissive than the app. Change both
 * together.
 *
 * 64 characters AND 72 bytes max: bcrypt holds at most 72 bytes, and an
 * emoji or accented letter takes 2-4 bytes, so both are checked.
 * "Special" = anything that isn't a letter, digit or space, so any symbol
 * on a phone keyboard counts.
 */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 64;
export const PASSWORD_MAX_BYTES = 72;

/** Size in UTF-8 bytes (what bcrypt on the server counts). */
function utf8Bytes(s: string): number {
  let n = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }
  return n;
}

export type PasswordRule = { key: string; label: string; ok: boolean };

export function passwordRules(pw: string): PasswordRule[] {
  return [
    { key: 'length', label: `${PASSWORD_MIN}–${PASSWORD_MAX} characters`, ok: pw.length >= PASSWORD_MIN && pw.length <= PASSWORD_MAX && utf8Bytes(pw) <= PASSWORD_MAX_BYTES },
    { key: 'upper', label: 'A capital letter (A–Z)', ok: /[A-Z]/.test(pw) },
    { key: 'lower', label: 'A small letter (a–z)', ok: /[a-z]/.test(pw) },
    { key: 'digit', label: 'A number (0–9)', ok: /\d/.test(pw) },
    { key: 'special', label: 'A special character (! @ # ? …)', ok: /[^A-Za-z0-9\s]/.test(pw) },
  ];
}

export function isStrongPassword(pw: string): boolean {
  return passwordRules(pw).every((r) => r.ok);
}
