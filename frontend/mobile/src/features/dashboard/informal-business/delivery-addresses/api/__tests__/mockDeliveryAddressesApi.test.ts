/** The sample-data addresses follow the server's rules: max 5, one default, removed means gone. */
import { beforeEach, expect, test } from '@jest/globals';

import { ApiError } from '@/shared/api/client';

import { MAX_ADDRESSES } from '../../types';
import { mockDeliveryAddressesApi as api, resetMockDeliveryAddresses } from '../mockDeliveryAddressesApi';

const HOME = { label: 'Home', addressText: '12 Mthembu Street, Tembisa', latitude: -25.99, longitude: 28.22 };

beforeEach(() => resetMockDeliveryAddresses());

test('one default at a time, listed first', async () => {
  const shop = await api.add({ ...HOME, label: 'Shop', isDefault: true });
  const site = await api.add({ ...HOME, label: 'Site' });
  expect((await api.list()).map((a) => a.label)).toEqual(['Shop', 'Site']);
  await api.makeDefault(site.id);
  const list = await api.list();
  expect(list.map((a) => [a.label, a.isDefault])).toEqual([
    ['Site', true],
    ['Shop', false],
  ]);
  expect(list.find((a) => a.id === shop.id)?.isDefault).toBe(false);
});

test(`at most ${MAX_ADDRESSES}`, async () => {
  for (let i = 0; i < MAX_ADDRESSES; i++) await api.add({ ...HOME, label: `Place ${i}` });
  await expect(api.add(HOME)).rejects.toBeInstanceOf(ApiError);
});

test('removed means gone', async () => {
  const a = await api.add(HOME);
  await api.remove(a.id);
  expect(await api.list()).toEqual([]);
  await expect(api.update(a.id, { label: 'Back' })).rejects.toBeInstanceOf(ApiError);
});
