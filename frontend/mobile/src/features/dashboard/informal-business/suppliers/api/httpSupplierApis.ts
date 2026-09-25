/**
 * Suppliers on the server: the recommendation engine, supplier pages and
 * connections (/suppliers/*, /me/suppliers). snake_case on the wire is
 * mapped to the app's camelCase here and nowhere else. The engine reads
 * the trader's SAVED business profile, so the MatchInput the mock needs is
 * ignored here.
 */
import type { CategoryCode } from '@/constants/categories';
import { api } from '@/shared/api/client';

import type { OpeningHours, Supplier, SupplierApi, SupplierMatch, SupplierMatchApi } from '../types';

type WireMatch = {
  id: string;
  name: string;
  initials: string;
  color: string;
  logo_url: string | null;
  verified: boolean;
  area: string;
  accepts_in_app: boolean;
  accepts_cash: boolean;
  minimum_order_cents: number;
  distance_km: number;
  shared_categories: CategoryCode[];
  within_reach: boolean;
  delivers_to_you: boolean;
  connected: boolean;
  reasons: string[];
  caution: string | null;
  score: number;
};

type WireSupplier = {
  id: string;
  name: string;
  initials: string;
  color: string;
  logo_url: string | null;
  verified: boolean;
  about: string;
  area: string;
  address: string;
  hours: { days: string; open: string; close: string }[];
  delivers: boolean;
  delivery_radius_km: number;
  delivery_fee_cents: number;
  free_delivery_over_cents: number | null;
  collect: boolean;
  accepts_in_app: boolean;
  accepts_cash: boolean;
  cash_limit_cents: number | null;
  minimum_order_cents: number;
  categories: CategoryCode[];
  reasons: string[];
  caution: string | null;
};

/** "mon-fri" -> "Mon-Fri", "public-holidays" -> "Public holidays". */
function days(code: string): string {
  if (code === 'public-holidays') return 'Public holidays';
  return code
    .split('-')
    .map((d) => d.charAt(0).toUpperCase() + d.slice(1))
    .join('-');
}

function match(m: WireMatch): SupplierMatch {
  return {
    id: m.id,
    name: m.name,
    initials: m.initials,
    color: m.color,
    area: m.area,
    distanceKm: m.distance_km,
    sharedCategories: m.shared_categories,
    payfast: m.accepts_in_app,
    cash: m.accepts_cash,
    delivers: m.delivers_to_you,
    minOrderCents: m.minimum_order_cents,
    reasons: m.reasons,
    withinReach: m.within_reach,
    verified: m.verified,
    logoUrl: m.logo_url,
    connected: m.connected,
    caution: m.caution ?? undefined,
    score: m.score,
  };
}

export function supplierFromWire(s: WireSupplier): Supplier {
  return {
    id: s.id,
    name: s.name,
    initials: s.initials,
    color: s.color,
    about: s.about,
    area: s.area,
    address: s.address,
    hours: s.hours.map((h): OpeningHours => ({ days: days(h.days), open: h.open, close: h.close })),
    delivers: s.delivers,
    deliveryRadiusKm: s.delivery_radius_km,
    deliveryFeeCents: s.delivery_fee_cents,
    freeDeliveryOverCents: s.free_delivery_over_cents,
    collect: s.collect,
    payfast: s.accepts_in_app,
    cash: s.accepts_cash,
    cashLimitCents: s.cash_limit_cents,
    minOrderCents: s.minimum_order_cents,
    categories: s.categories,
    logoUrl: s.logo_url,
    verified: s.verified,
    reasons: s.reasons,
    caution: s.caution ?? undefined,
  };
}

export const httpSupplierMatchApi: SupplierMatchApi = {
  async matchSuppliers() {
    const data = await api<{ suppliers: WireMatch[] }>('GET', '/suppliers/recommended', undefined, { auth: true });
    return data.suppliers.map(match);
  },
};

export const httpSupplierApi: SupplierApi = {
  async get(id) {
    const data = await api<{ supplier: WireSupplier }>('GET', `/suppliers/${encodeURIComponent(id)}`, undefined, { auth: true });
    return supplierFromWire(data.supplier);
  },
};

export type ConnectionsApi = {
  connect(supplierId: string): Promise<void>;
  disconnect(supplierId: string): Promise<void>;
};

export const httpConnectionsApi: ConnectionsApi = {
  async connect(supplierId) {
    await api('PUT', `/me/suppliers/${encodeURIComponent(supplierId)}`, undefined, { auth: true });
  },
  async disconnect(supplierId) {
    await api('DELETE', `/me/suppliers/${encodeURIComponent(supplierId)}`, undefined, { auth: true });
  },
};

/** Mock mode keeps connections on the phone only (the profile's supplierIds). */
export const mockConnectionsApi: ConnectionsApi = {
  async connect() {},
  async disconnect() {},
};
