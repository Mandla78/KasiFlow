/**
 * One supplier's page: GET /suppliers/{id} on the server, or the mock.
 */
import { USE_MOCK_AUTH } from '@/constants/config';

import type { Supplier, SupplierApi } from '../types';
import { httpSupplierApi } from './httpSupplierApis';
import { findMockSupplier } from './mockSupplierData';
import { matchOne } from './mockSupplierMatchApi';

const wait = (ms = 350) => new Promise((r) => setTimeout(r, ms));

export class SupplierNotFound extends Error {}

const mockSupplierApi: SupplierApi = {
  async get(id, trader) {
    await wait();
    const s = findMockSupplier(id);
    if (!s) throw new SupplierNotFound(id);
    const match = trader ? matchOne(s, trader) : null;
    const supplier: Supplier = {
      id: s.id, name: s.name, initials: s.initials, color: s.color, about: s.about, area: s.area,
      address: s.address, hours: s.hours, delivers: s.deliveryRadiusKm > 0, deliveryRadiusKm: s.deliveryRadiusKm,
      deliveryFeeCents: s.deliveryFeeCents, freeDeliveryOverCents: s.freeDeliveryOverCents, collect: s.collect,
      payfast: s.payfast, cash: s.cash, cashLimitCents: s.cashLimitCents, minOrderCents: s.minOrderCents,
      categories: s.categories, logoUrl: s.logoUrl, verified: s.verified,
      reasons: match?.reasons ?? [], caution: match?.caution,
    };
    return supplier;
  },
};

export const supplierApi: SupplierApi = USE_MOCK_AUTH ? mockSupplierApi : httpSupplierApi;
