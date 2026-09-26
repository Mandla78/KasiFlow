/** Sample-data delivery addresses: the server's rules, kept on the phone. */
import { ApiError } from '@/shared/api/client';

import { MAX_ADDRESSES, type DeliveryAddress, type DeliveryAddressesApi } from '../types';

let items: DeliveryAddress[] = [];
let next = 1;

const sorted = () => [...items].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
const find = (id: string) => {
  const a = items.find((x) => x.id === id);
  if (!a) throw new ApiError(404, 'NOT_FOUND', "We couldn't find that address.");
  return a;
};

export const mockDeliveryAddressesApi: DeliveryAddressesApi = {
  async list() {
    return sorted();
  },
  async add(a) {
    if (items.length >= MAX_ADDRESSES) throw new ApiError(409, 'TOO_MANY_ADDRESSES', `You can keep ${MAX_ADDRESSES} addresses. Remove one first.`);
    if (a.isDefault) items = items.map((x) => ({ ...x, isDefault: false }));
    const saved = { ...a, id: `addr-${next++}`, isDefault: a.isDefault ?? false };
    items = [...items, saved];
    return saved;
  },
  async update(id, c) {
    const saved = { ...find(id), ...c };
    items = items.map((x) => (x.id === id ? saved : x));
    return saved;
  },
  async remove(id) {
    find(id);
    items = items.filter((x) => x.id !== id);
  },
  async makeDefault(id) {
    find(id);
    items = items.map((x) => ({ ...x, isDefault: x.id === id }));
    return find(id);
  },
};

/** Tests only: start empty. */
export function resetMockDeliveryAddresses() {
  items = [];
  next = 1;
}
