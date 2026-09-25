/**
 * MOCK supplier engine -- the same rules the backend will run, so the
 * Suppliers tab behaves the same after wiring.
 *
 *   1. Must sell at least one category the trader buys.
 *   2. Must reach the trader: delivers within its radius, or (if the trader
 *      collects) is within 15 km.
 *   3. If the trader has said how they pay, the supplier must accept it.
 *   Score = category fit (50) + closeness (30) + payment fit (10) +
 *   minimum-order fit (10). A minimum order above the trader's usual spend
 *   is a caution, not an exclusion. Unknown payment or spend: no filter.
 */
import { categoryByCode } from '@/constants/categories';
import type { Buying } from '@/features/auth/types';
import { formatRand } from '@/shared/lib/money';

import type { SupplierMatch, SupplierMatchApi } from '../types';
import { MOCK_SUPPLIERS as SUPPLIERS } from './mockSupplierData';

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

export const mockSupplierMatchApi: SupplierMatchApi = {
  async matchSuppliers({ place, categories, buying }) {
    await wait(700);
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

      const payOk = buying.payment === 'payfast' ? s.payfast : buying.payment === 'cash' ? s.cash : true;
      if (!payOk) continue;

      const reach = delivers ? s.deliveryRadiusKm : COLLECT_RADIUS_KM;
      const minOk = spendMax === null || s.minOrderCents <= spendMax;
      const score = (shared.length / Math.max(categories.length, 1)) * 50 + (1 - km / reach) * 30 + 10 + (minOk ? 10 : 0);

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
        reasons: [
          `${km.toFixed(1)} km away · ${delivers ? 'delivers to you' : 'you can collect'}`,
          `Sells ${shared.length} of your ${categories.length} categories: ${shared
            .slice(0, 3)
            .map((c) => categoryByCode(c).label)
            .join(', ')}${shared.length > 3 ? '…' : ''}`,
          [s.payfast && 'Accepts payment in the app', s.cash && 'cash on delivery'].filter(Boolean).join(' · '),
        ],
        caution: minOk ? undefined : `Minimum order ${formatRand(s.minOrderCents)}, more than your usual spend`,
        score,
      });
    }
    return matches.sort((a, b) => b.score - a.score);
  },
};
