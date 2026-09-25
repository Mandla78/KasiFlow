/**
 * Products and categories. Mock for now (docs/supplier/02); the HTTP
 * version calls GET /suppliers/{id}/products and GET /products/{id}.
 */
import type { CatalogueApi, Product } from '../types';
import { findMockProduct, MOCK_PRODUCTS } from './mockCatalogueData';

const wait = (ms = 350) => new Promise((r) => setTimeout(r, ms));

export class ProductNotFound extends Error {}

const mockCatalogueApi: CatalogueApi = {
  async products(supplierId, query = {}) {
    await wait();
    const q = query.search?.trim().toLowerCase() ?? '';
    return MOCK_PRODUCTS.filter(
      (p) =>
        p.supplierId === supplierId &&
        (!query.category || p.category === query.category) &&
        (!q || `${p.name} ${p.brand} ${p.packSize}`.toLowerCase().includes(q)),
    );
  },
  async product(id): Promise<Product> {
    await wait(150);
    const p = findMockProduct(id);
    if (!p) throw new ProductNotFound(id);
    return p;
  },
};

export const catalogueApi: CatalogueApi = mockCatalogueApi;
