/**
 * One supplier's page. Mock for now (docs/supplier/02); the HTTP version
 * calls GET /suppliers/{id} with the same shape.
 */
import type { Supplier, SupplierApi } from '../types';
import { findMockSupplier } from './mockSupplierData';

const wait = (ms = 350) => new Promise((r) => setTimeout(r, ms));

export class SupplierNotFound extends Error {}

const mockSupplierApi: SupplierApi = {
  async get(id) {
    await wait();
    const s = findMockSupplier(id);
    if (!s) throw new SupplierNotFound(id);
    const supplier: Supplier = {
      id: s.id, name: s.name, initials: s.initials, color: s.color, about: s.about, area: s.area,
      address: s.address, hours: s.hours, delivers: s.deliveryRadiusKm > 0, deliveryRadiusKm: s.deliveryRadiusKm,
      deliveryFeeCents: s.deliveryFeeCents, freeDeliveryOverCents: s.freeDeliveryOverCents, collect: s.collect,
      payfast: s.payfast, cash: s.cash, cashLimitCents: s.cashLimitCents, minOrderCents: s.minOrderCents,
      categories: s.categories, logoUrl: null,
    };
    return supplier;
  },
};

export const supplierApi: SupplierApi = mockSupplierApi;
