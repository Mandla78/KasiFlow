/**
 * The wire -> app mapping for suppliers and products, fed the exact
 * shapes the server returns (the backend supplier API routes).
 */
import { beforeEach, expect, jest, test } from '@jest/globals';

import { httpCatalogueApi } from '../../../catalogue/api/httpCatalogueApi';
import { httpConnectionsApi, httpSupplierApi, httpSupplierMatchApi } from '../httpSupplierApis';

const mockCalls: { method: string; path: string }[] = [];
let mockReplies: unknown[] = [];
jest.mock('@/shared/api/client', () => ({
  api: async (method: string, path: string) => {
    mockCalls.push({ method, path });
    return mockReplies.shift();
  },
}));

beforeEach(() => {
  mockCalls.length = 0;
  mockReplies = [];
});

const SUPPLIER = {
  id: 's1', name: 'Mahlangu Wholesale', initials: 'MW', color: '#1F2A44', logo_url: null, verified: true,
  about: 'Groceries.', area: 'Tembisa', address: '14 Andrew Mapheto Drive, Tembisa',
  hours: [{ days: 'mon-fri', open: '07:00', close: '17:00' }, { days: 'public-holidays', open: '08:00', close: '12:00' }],
  delivers: true, delivery_radius_km: 15, delivery_fee_cents: 3500, free_delivery_over_cents: 150000, collect: true,
  accepts_in_app: true, accepts_cash: true, cash_limit_cents: 100000, minimum_order_cents: 50000,
  categories: ['food_grocery'], reasons: ['1.2 km away · delivers to you'], caution: null,
};

test('a supplier page maps to the app shape', async () => {
  mockReplies = [{ supplier: SUPPLIER }];
  const s = await httpSupplierApi.get('s1');
  expect(mockCalls[0]).toEqual({ method: 'GET', path: '/suppliers/s1' });
  expect(s.payfast).toBe(true);
  expect(s.cashLimitCents).toBe(100000);
  expect(s.minOrderCents).toBe(50000);
  expect(s.hours.map((h) => h.days)).toEqual(['Mon-Fri', 'Public holidays']);
  expect(s.caution).toBeUndefined();
});

test('recommendations keep the connected flag and reasons', async () => {
  mockReplies = [{
    suppliers: [{
      id: 's1', name: 'Mahlangu Wholesale', initials: 'MW', color: '#1F2A44', logo_url: null, verified: true, area: 'Tembisa',
      accepts_in_app: true, accepts_cash: false, minimum_order_cents: 50000, distance_km: 1.2, shared_categories: ['food_grocery'],
      within_reach: true, delivers_to_you: true, connected: true, reasons: ['a', 'b', 'c'], caution: null, score: 91.5,
    }],
  }];
  const [m] = await httpSupplierMatchApi.matchSuppliers({} as never);
  expect(m).toMatchObject({ id: 's1', distanceKm: 1.2, withinReach: true, delivers: true, connected: true, cash: false, score: 91.5 });
});

test('the catalogue reads every page and passes search and category', async () => {
  const p = {
    id: 'p1', supplier_id: 's1', name: 'Maize meal', brand: 'Kasi Gold', category: 'food_grocery', unit: 'bag', pack_size: '10 kg',
    units_per_pack: 1, price_cents: 8999, compare_at_price_cents: null, vat_included: true, vat_rate: 'zero', stock: 'low',
    min_qty: 1, max_qty: 50, description: '', images: [],
  };
  mockReplies = [{ products: [p], page: 1, has_more: true, total: 2 }, { products: [{ ...p, id: 'p2' }], page: 2, has_more: false, total: 2 }];
  const all = await httpCatalogueApi.products('s1', { category: 'food_grocery', search: ' maize ' });
  expect(all.map((x) => x.id)).toEqual(['p1', 'p2']);
  expect(mockCalls[0].path).toBe('/suppliers/s1/products?category=food_grocery&q=maize&page=1');
  expect(mockCalls[1].path).toContain('page=2');
  expect(all[0]).toMatchObject({ packSize: '10 kg', vatRate: 'zero', stock: 'low', images: [null] });
});

test('connect is a PUT and disconnect a DELETE on the same address', async () => {
  mockReplies = [{}, {}];
  await httpConnectionsApi.connect('s1');
  await httpConnectionsApi.disconnect('s1');
  expect(mockCalls).toEqual([{ method: 'PUT', path: '/me/suppliers/s1' }, { method: 'DELETE', path: '/me/suppliers/s1' }]);
});
