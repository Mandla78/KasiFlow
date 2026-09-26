/** The catalogue comes a page at a time, like the server: 60, then the next 60. */
import { expect, jest, test } from '@jest/globals';

jest.mock('@/constants/config', () => ({ USE_MOCK_AUTH: true }));

import { catalogueApi, PAGE_SIZE } from '../catalogueApi';
import { MOCK_PRODUCTS } from '../mockCatalogueData';

test('pages add up to the whole catalogue, in order, with no repeats', async () => {
  const supplierId = MOCK_PRODUCTS[0].supplierId;
  const whole = await catalogueApi.products(supplierId);
  const seen: string[] = [];
  for (let page = 1; ; page++) {
    const r = await catalogueApi.page(supplierId, {}, page);
    expect(r.products.length).toBeLessThanOrEqual(PAGE_SIZE);
    seen.push(...r.products.map((p) => p.id));
    if (!r.hasMore) break;
  }
  expect(seen).toEqual(whole.map((p) => p.id));
});
