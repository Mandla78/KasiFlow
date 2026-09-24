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
 * 64 max: bcrypt only reads the first 72 bytes of a password.
 * "Special" = anything that isn't a letter, digit or space, so any symbol
 * on a phone keyboard counts.
 */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 64;

export type PasswordRule = { key: string; label: string; ok: boolean };

export function passwordRules(pw: string): PasswordRule[] {
  return [
    { key: 'length', label: `${PASSWORD_MIN}–${PASSWORD_MAX} characters`, ok: pw.length >= PASSWORD_MIN && pw.length <= PASSWORD_MAX },
    { key: 'upper', label: 'A capital letter (A–Z)', ok: /[A-Z]/.test(pw) },
    { key: 'lower', label: 'A small letter (a–z)', ok: /[a-z]/.test(pw) },
    { key: 'digit', label: 'A number (0–9)', ok: /\d/.test(pw) },
    { key: 'special', label: 'A special character (! @ # ? …)', ok: /[^A-Za-z0-9\s]/.test(pw) },
  ];
}

export function isStrongPassword(pw: string): boolean {
  return passwordRules(pw).every((r) => r.ok);
}
