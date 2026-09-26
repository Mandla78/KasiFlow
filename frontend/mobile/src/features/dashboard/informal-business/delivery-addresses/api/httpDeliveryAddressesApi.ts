/** Delivery addresses on the server (/me/delivery-addresses). */
import { api } from '@/shared/api/client';

import type { DeliveryAddress, DeliveryAddressesApi } from '../types';

type Wire = { id: string; label: string; address_text: string; latitude: number; longitude: number; is_default: boolean };

const fromWire = (w: Wire): DeliveryAddress => ({
  id: w.id,
  label: w.label,
  addressText: w.address_text,
  latitude: w.latitude,
  longitude: w.longitude,
  isDefault: w.is_default,
});

const path = (id: string) => `/me/delivery-addresses/${encodeURIComponent(id)}`;

export const httpDeliveryAddressesApi: DeliveryAddressesApi = {
  async list() {
    return (await api<{ addresses: Wire[] }>('GET', '/me/delivery-addresses', undefined, { auth: true })).addresses.map(fromWire);
  },
  async add(a, idempotencyKey) {
    const body = { label: a.label, address_text: a.addressText, latitude: a.latitude, longitude: a.longitude, is_default: a.isDefault ?? false };
    const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined;
    return fromWire((await api<{ address: Wire }>('POST', '/me/delivery-addresses', body, { auth: true, headers })).address);
  },
  async update(id, c) {
    const body: Record<string, unknown> = {};
    if (c.label !== undefined) body.label = c.label;
    if (c.addressText !== undefined) body.address_text = c.addressText;
    if (c.latitude !== undefined && c.longitude !== undefined) {
      body.latitude = c.latitude;
      body.longitude = c.longitude;
    }
    return fromWire((await api<{ address: Wire }>('PATCH', path(id), body, { auth: true })).address);
  },
  async remove(id) {
    await api('DELETE', path(id), undefined, { auth: true });
  },
  async makeDefault(id) {
    return fromWire((await api<{ address: Wire }>('POST', `${path(id)}/default`, undefined, { auth: true })).address);
  },
};
