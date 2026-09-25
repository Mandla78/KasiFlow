/**
 * MOCK supplier recommendation engine -- the same idea the backend will run.
 * It RANKS, it never hides: every supplier shows, best fit first, each with
 * plain reasons (including honest ones like "outside their delivery area").
 *
 *   Score = what you buy (40) + reach (35: delivers to you > you can collect
 *   > far) + closeness (10) + how you pay (10) + minimum order fits (5).
 *   A minimum order above the trader's usual spend is a caution.
 */
import { categoryByCode } from '@/constants/categories';
import type { Buying } from '@/features/auth/types';
import { formatRand } from '@/shared/lib/money';

import type { MatchInput, SupplierMatch, SupplierMatchApi } from '../types';
import { MockSupplier, MOCK_SUPPLIERS as SUPPLIERS } from './mockSupplierData';

const wait = (ms = 700) => new Promise((r) => setTimeout(r, ms));

const COLLECT_RADIUS_KM = 15;

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

/** How well one supplier fits this trader, with the plain reasons. */
export function matchOne(s: MockSupplier, { place, categories, buying }: MatchInput): SupplierMatch {
  const wantsCollect = buying.fulfilment === 'collect';
  const canCollect = buying.fulfilment !== 'delivery';
  const spendMax = buying.spend ? SPEND_MAX[buying.spend] : null;

  const shared = s.categories.filter((c) => categories.includes(c));
  const km = distanceKm(place.latitude, place.longitude, s.latitude, s.longitude);
  const delivers = !wantsCollect && km <= s.deliveryRadiusKm;
  const collectable = canCollect && km <= COLLECT_RADIUS_KM;
  const payOk = buying.payment === 'payfast' ? s.payfast : buying.payment === 'cash' ? s.cash : true;
  const minOk = spendMax === null || s.minOrderCents <= spendMax;

  const fit = shared.length / Math.max(categories.length, 1);
  const reachScore = delivers ? 35 : collectable ? 25 : 0;
  const closeness = Math.max(0, 1 - km / 100) * 10;
  const score = fit * 40 + reachScore + closeness + (payOk ? 10 : 0) + (minOk ? 5 : 0);

  const where = delivers
    ? `${km.toFixed(1)} km away · delivers to you`
    : collectable
      ? `${km.toFixed(1)} km away · you can collect`
      : `${km.toFixed(0)} km away · outside their delivery area`;
  const what = shared.length
    ? `Sells ${shared.length} of your ${categories.length} categories: ${shared
        .slice(0, 3)
        .map((c) => categoryByCode(c).label)
        .join(', ')}${shared.length > 3 ? '…' : ''}`
    : `Sells ${s.categories
        .slice(0, 3)
        .map((c) => categoryByCode(c).label)
        .join(', ')}`;

  return {
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
    withinReach: delivers || collectable,
    verified: s.verified,
    logoUrl: s.logoUrl,
    reasons: [where, what, [s.payfast && 'Accepts payment in the app', s.cash && 'cash on delivery'].filter(Boolean).join(' · ')],
    caution: minOk ? undefined : `Minimum order ${formatRand(s.minOrderCents)}, more than your usual spend`,
    score,
  };
}

export const mockSupplierMatchApi: SupplierMatchApi = {
  async matchSuppliers(input) {
    await wait(700);
    return SUPPLIERS.map((s) => matchOne(s, input)).sort((a, b) => b.score - a.score);
  },
};
