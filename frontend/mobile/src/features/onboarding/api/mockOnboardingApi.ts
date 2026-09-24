/**
 * MOCK onboarding API. Mirrors what the backend will do so the screens
 * behave the same after wiring.
 *
 * CIPC -- a fake register, so every outcome is reachable. The real check
 * runs on the backend after the step is saved; the rule is the same:
 *   2020/123456/07  active, director NOMSA DLAMINI -> "verified" if the
 *                   user's name matches, otherwise "owner_unconfirmed"
 *   2021/654321/07  active, director THABO MOKOENA -> "owner_unconfirmed"
 *                   (the company exists, but it isn't this user's)
 *   2019/111111/07  deregistered
 *   2018/999999/07  CIPC unreachable -> "unavailable" (backend retries)
 *   anything else   not found
 */
import type { OnboardingApi } from '../types';

const wait = (ms = 700) => new Promise((r) => setTimeout(r, ms));

// The fake register (what CIPC's company + directors endpoints return).
const REGISTER: Record<string, { name: string; type: string; status: string; directors: string[] }> = {
  '2020/123456/07': { name: 'N DLAMINI TRADING (PTY) LTD', type: 'Private Company', status: 'In Business', directors: ['NOMSA DLAMINI'] },
  '2021/654321/07': { name: 'MOKOENA BUILD (PTY) LTD', type: 'Private Company', status: 'In Business', directors: ['THABO MOKOENA'] },
  '2019/111111/07': { name: 'KASI BUILD CC', type: 'Close Corporation', status: 'Deregistered', directors: ['SIPHO NDLOVU'] },
};

/** Every word of the user's name appears in the director's name (case and spacing ignored). */
function sameName(director: string, person: string): boolean {
  const words = person.toUpperCase().split(/\s+/).filter(Boolean);
  const d = director.toUpperCase();
  return words.length > 0 && words.every((w) => d.includes(w));
}

export const mockOnboardingApi: OnboardingApi = {
  async verifyCipc(number, ownerName) {
    await wait(2500); // a background check, not instant
    const checkedAt = new Date().toISOString();
    if (number === '2018/999999/07') return { status: 'unavailable', checkedAt };
    const company = REGISTER[number];
    if (!company) return { status: 'not_found', checkedAt };
    const base = { registeredName: company.name, entityType: company.type, checkedAt };
    if (company.status !== 'In Business') return { status: 'deregistered', ...base };
    const owns = company.directors.some((d) => sameName(d, ownerName));
    return { status: owns ? 'verified' : 'owner_unconfirmed', ...base };
  },
};
