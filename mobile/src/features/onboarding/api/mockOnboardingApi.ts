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
 *
 * SUPPLIER ENGINE -- the same rules the backend will run:
 *   1. Must sell at least one category the trader buys.
 *   2. Must reach the trader: delivers within its radius, or (if the trader
 *      collects) is within 15 km.
 *   3. Must accept a payment method the trader uses.
 *   Score = category fit (50) + closeness (30) + payment fit (10) +
 *   minimum-order fit (10). A minimum order above the trader's usual spend
 *   is a caution, not an exclusion.
 */
import { CategoryCode, categoryByCode } from '@/constants/categories';
import type { Buying } from '@/features/auth/types';
import { formatRand } from '@/shared/lib/money';

import type { OnboardingApi, SupplierMatch } from '../types';

const wait = (ms = 700) => new Promise((r) => setTimeout(r, ms));

const COLLECT_RADIUS_KM = 15;

type MockSupplier = {
  id: string;
  name: string;
  initials: string;
  color: string;
  area: string;
  latitude: number;
  longitude: number;
  deliveryRadiusKm: number;
  categories: CategoryCode[];
  payfast: boolean;
  cash: boolean;
  minOrderCents: number;
};

const SUPPLIERS: MockSupplier[] = [
  {
    id: 'mw', name: 'Mahlangu Wholesale', initials: 'MW', color: '#1F2A44', area: 'Tembisa',
    latitude: -25.999, longitude: 28.227, deliveryRadiusKm: 15,
    categories: ['food_grocery', 'beverages', 'snacks_confectionery', 'household_cleaning', 'personal_care', 'dairy_chilled'],
    payfast: true, cash: true, minOrderCents: 50000,
  },
  {
    id: 'dd', name: 'Dlamini Drinks', initials: 'DD', color: '#2F5D8A', area: 'Tembisa',
    latitude: -25.985, longitude: 28.21, deliveryRadiusKm: 12,
    categories: ['beverages', 'snacks_confectionery'], payfast: true, cash: false, minOrderCents: 30000,
  },
  {
    id: 'kb', name: 'Kasi Bakers', initials: 'KB', color: '#8A5A1E', area: 'Ivory Park',
    latitude: -25.994, longitude: 28.183, deliveryRadiusKm: 8,
    categories: ['bakery'], payfast: true, cash: true, minOrderCents: 20000,
  },
  {
    id: 'cc', name: 'Clean & Care Distributors', initials: 'CC', color: '#3B6E5A', area: 'Kempton Park',
    latitude: -26.1, longitude: 28.23, deliveryRadiusKm: 20,
    categories: ['household_cleaning', 'personal_care', 'baby_family', 'packaging_disposable'],
    payfast: true, cash: true, minOrderCents: 80000,
  },
  {
    id: 'nh', name: 'Ndlovu Hardware', initials: 'NH', color: '#5E5648', area: 'Tembisa',
    latitude: -26.01, longitude: 28.24, deliveryRadiusKm: 25,
    categories: ['building_materials', 'tools_hardware', 'paint_finishes', 'plumbing', 'electrical'],
    payfast: true, cash: true, minOrderCents: 100000,
  },
  {
    id: 'mb', name: 'Midrand Build & Plumb', initials: 'MB', color: '#6B3A2E', area: 'Midrand',
    latitude: -25.99, longitude: 28.13, deliveryRadiusKm: 30,
    categories: ['plumbing', 'electrical', 'building_materials'], payfast: true, cash: false, minOrderCents: 200000,
  },
  {
    id: 'sw', name: 'Soweto Cash & Carry', initials: 'SC', color: '#4A4E8A', area: 'Soweto',
    latitude: -26.24, longitude: 27.9, deliveryRadiusKm: 20,
    categories: ['food_grocery', 'beverages', 'household_cleaning', 'airtime_electricity'],
    payfast: true, cash: true, minOrderCents: 40000,
  },
];

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

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Upper end of the trader's usual spend, in cents (null = unknown). */
const SPEND_MAX: Record<NonNullable<Buying['spend']>, number | null> = {
  under_1k: 100000,
  '1k_5k': 500000,
  '5k_20k': 2000000,
  over_20k: null,
};


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

  async matchSuppliers({ place, categories, buying }) {
    await wait(800);
    const wantsCollect = buying.fulfilment === 'collect';
    const canCollect = buying.fulfilment !== 'delivery';
    const spendMax = buying.spend ? SPEND_MAX[buying.spend] : null;

    const matches: SupplierMatch[] = [];
    for (const s of SUPPLIERS) {
      const shared = s.categories.filter((c) => categories.includes(c));
      if (shared.length === 0) continue;

      const km = distanceKm(place.latitude, place.longitude, s.latitude, s.longitude);
      const delivers = !wantsCollect && km <= s.deliveryRadiusKm;
      const collectable = canCollect && km <= COLLECT_RADIUS_KM;
      if (!delivers && !collectable) continue;

      const payOk =
        buying.payment === 'payfast' ? s.payfast : buying.payment === 'cash' ? s.cash : s.payfast || s.cash;
      if (!payOk) continue;

      const reach = delivers ? s.deliveryRadiusKm : COLLECT_RADIUS_KM;
      const minOk = spendMax === null || s.minOrderCents <= spendMax;
      const score =
        (shared.length / Math.max(categories.length, 1)) * 50 + (1 - km / reach) * 30 + 10 + (minOk ? 10 : 0);

      const reasons = [
        `${km.toFixed(1)} km away · ${delivers ? 'delivers to you' : 'you can collect'}`,
        `Sells ${shared.length} of your ${categories.length} categories: ${shared
          .slice(0, 3)
          .map((c) => categoryByCode(c).label)
          .join(', ')}${shared.length > 3 ? '…' : ''}`,
        [s.payfast && 'PayFast', s.cash && 'cash on delivery'].filter(Boolean).join(' · '),
      ];

      matches.push({
        id: s.id,
        name: s.name,
        initials: s.initials,
        color: s.color,
        area: s.area,
        distanceKm: km,
        sharedCategories: shared,
        payfast: s.payfast,
        cash: s.cash,
        delivers,
        minOrderCents: s.minOrderCents,
        reasons,
        caution: minOk ? undefined : `Minimum order ${formatRand(s.minOrderCents)}, more than your usual spend`,
        score,
      });
    }
    return matches.sort((a, b) => b.score - a.score).slice(0, 5);
  },
};
