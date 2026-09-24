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
  /** Plain-language reasons shown on the card: why this supplier. */
  reasons: string[];
  /** A heads-up that doesn't exclude the supplier (e.g. minimum order). */
  caution?: string;
  score: number;
};

export interface SupplierMatchApi {
  /** Suppliers who fit this trader, best first, each with its reasons. */
  matchSuppliers(input: MatchInput): Promise<SupplierMatch[]>;
}
