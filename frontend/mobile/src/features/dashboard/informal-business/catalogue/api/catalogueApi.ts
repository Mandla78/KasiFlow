/**
 * Products and categories: the server (GET /suppliers/{id}/products,
 * GET /products/{id}), or the mock.
 */
import { USE_MOCK_AUTH } from '@/constants/config';

import type { CatalogueApi, Product, ProductQuery } from '../types';
import { httpCatalogueApi } from './httpCatalogueApi';
import { findMockProduct, MOCK_PRODUCTS } from './mockCatalogueData';

const wait = (ms = 350) => new Promise((r) => setTimeout(r, ms));

export class ProductNotFound extends Error {}

/** Same page size as the server. */
export const PAGE_SIZE = 60;

function matching(supplierId: string, query: ProductQuery): Product[] {
  const q = query.search?.trim().toLowerCase() ?? '';
  return MOCK_PRODUCTS.filter(
    (p) =>
      p.supplierId === supplierId &&
      (!query.category || p.category === query.category) &&
      (!q || `${p.name} ${p.brand} ${p.packSize}`.toLowerCase().includes(q)),
  );
}

const mockCatalogueApi: CatalogueApi = {
  async products(supplierId, query = {}) {
    await wait();
    return matching(supplierId, query);
  },
  async page(supplierId, query, page) {
    await wait();
    const all = matching(supplierId, query);
    return { products: all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), hasMore: all.length > page * PAGE_SIZE };
  },
  async product(id): Promise<Product> {
    await wait(150);
    const p = findMockProduct(id);
    if (!p) throw new ProductNotFound(id);
    return p;
  },
};

export const catalogueApi: CatalogueApi = USE_MOCK_AUTH ? mockCatalogueApi : httpCatalogueApi;
