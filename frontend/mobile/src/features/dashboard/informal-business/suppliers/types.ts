import { CategoryCode } from '@/constants/categories';
import type { Buying, Place } from '@/features/auth/types';

/** What the supplier engine needs about the trader. */
export type MatchInput = {
  place: Place;
  categories: CategoryCode[];
  buying: Buying;
};

export type SupplierMatch = {
  id: string;
  name: string;
  initials: string;
  color: string;
  area: string;
  distanceKm: number;
  sharedCategories: CategoryCode[];
  payfast: boolean;
  cash: boolean;
  delivers: boolean;
  minOrderCents: number;
  /** Plain-language reasons (shown on the supplier's page, not the card). */
  reasons: string[];
  /** Delivers to the trader, or close enough to collect. */
  withinReach: boolean;
  verified: boolean;
  logoUrl: string | null;
  /** From the server: already connected (mock mode keeps it in the profile). */
  connected?: boolean;
  /** A heads-up that doesn't exclude the supplier (e.g. minimum order). */
  caution?: string;
  score: number;
};

export interface SupplierMatchApi {
  /** Suppliers who fit this trader, best first, each with its reasons. */
  matchSuppliers(input: MatchInput): Promise<SupplierMatch[]>;
}

/** When a supplier is open, e.g. { days: 'Mon-Fri', open: '07:00', close: '17:00' }. */
export type OpeningHours = { days: string; open: string; close: string };

/** A supplier's page: who they are and how they sell. */
export type Supplier = {
  id: string;
  name: string;
  initials: string;
  color: string;
  about: string;
  area: string;
  /** Where to collect, as one line. */
  address: string;
  hours: OpeningHours[];
  delivers: boolean;
  deliveryRadiusKm: number;
  deliveryFeeCents: number;
  /** Delivery is free from this order total (null = never free). */
  freeDeliveryOverCents: number | null;
  collect: boolean;
  payfast: boolean;
  cash: boolean;
  /** Most cash they take per order (null = no cash). */
  cashLimitCents: number | null;
  minOrderCents: number;
  categories: CategoryCode[];
  logoUrl: string | null;
  verified: boolean;
  /** Why we suggest them to this trader (same reasons as the engine's). */
  reasons: string[];
  caution?: string;
};

export interface SupplierApi {
  /** `trader` is who's asking. The real API reads it from the session; the mock needs it passed. */
  get(id: string, trader?: MatchInput): Promise<Supplier>;
}
