/**
 * A supplier's catalogue on the server (/suppliers/{id}/products,
 * /products/{id}). The server pages 60 at a time; the grid shows a whole
 * search result, so this reads the pages in turn (a few hundred products
 * at most). Product codes, barcodes and stock numbers never come back:
 * only in stock / low / out.
 */
import type { CategoryCode } from '@/constants/categories';
import { api } from '@/shared/api/client';

import type { CatalogueApi, Product, StockLevel } from '../types';

type WireProduct = {
  id: string;
  supplier_id: string;
  name: string;
  brand: string;
  category: CategoryCode;
  unit: string;
  pack_size: string;
  units_per_pack: number;
  price_cents: number;
  compare_at_price_cents: number | null;
  vat_included: boolean;
  vat_rate: 'standard' | 'zero';
  stock: StockLevel;
  min_qty: number;
  max_qty: number;
  description: string;
  images: string[];
};

type WirePage = { products: WireProduct[]; page: number; has_more: boolean; total: number };

const MAX_PAGES = 10;

function product(p: WireProduct): Product {
  return {
    id: p.id,
    supplierId: p.supplier_id,
    name: p.name,
    brand: p.brand,
    category: p.category,
    unit: p.unit,
    packSize: p.pack_size,
    unitsPerPack: p.units_per_pack,
    priceCents: p.price_cents,
    compareAtPriceCents: p.compare_at_price_cents,
    vatIncluded: p.vat_included,
    vatRate: p.vat_rate,
    stock: p.stock,
    minQty: p.min_qty,
    maxQty: p.max_qty,
    description: p.description,
    // No photos yet: one empty slot so the category placeholder shows.
    images: p.images.length ? p.images : [null],
  };
}

export const httpCatalogueApi: CatalogueApi = {
  async products(supplierId, query = {}) {
    const params = new URLSearchParams();
    if (query.category) params.set('category', query.category);
    if (query.search?.trim()) params.set('q', query.search.trim());
    const all: Product[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      params.set('page', String(page));
      const data = await api<WirePage>('GET', `/suppliers/${encodeURIComponent(supplierId)}/products?${params}`, undefined, { auth: true });
      all.push(...data.products.map(product));
      if (!data.has_more) break;
    }
    return all;
  },
  async product(id) {
    const data = await api<{ product: WireProduct }>('GET', `/products/${encodeURIComponent(id)}`, undefined, { auth: true });
    return product(data.product);
  },
};
