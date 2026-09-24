import { CategoryCode } from '@/constants/categories';
import type { Buying, CipcStatus, Place } from '@/features/auth/types';

export type CipcResult = { status: Exclude<CipcStatus, 'pending'>; registeredName?: string; entityType?: string; checkedAt: string };

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

export interface OnboardingApi {
  /**
   * The backend's CIPC check, run behind the scenes after the step is
   * saved (never a button the user presses): looks the number up, checks
   * the company is active, and matches the user's name against its
   * directors.
   */
  verifyCipc(number: string, ownerName: string): Promise<CipcResult>;
  /** Suppliers who fit this trader, best first, each with its reasons. */
  matchSuppliers(input: MatchInput): Promise<SupplierMatch[]>;
}
