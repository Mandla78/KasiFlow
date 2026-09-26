/**
 * A supplier's catalogue on the server (/suppliers/{id}/products,
 * /products/{id}). The server pages 60 at a time: the supplier screen asks
 * for one page and the next as the trader scrolls (page()); products()
 * still reads every page, for the few places that need a whole list.
 * Product codes, barcodes and stock numbers never come back: only
 * in stock / low / out.
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

function params(query: { category?: string; search?: string }): URLSearchParams {
  const p = new URLSearchParams();
  if (query.category) p.set('category', query.category);
  if (query.search?.trim()) p.set('q', query.search.trim());
  return p;
}

export const httpCatalogueApi: CatalogueApi = {
  async page(supplierId, query, page) {
    const p = params(query);
    p.set('page', String(page));
    const data = await api<WirePage>('GET', `/suppliers/${encodeURIComponent(supplierId)}/products?${p}`, undefined, { auth: true });
    return { products: data.products.map(product), hasMore: data.has_more };
  },
  async products(supplierId, query = {}) {
    const all: Product[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const data = await httpCatalogueApi.page(supplierId, query, page);
      all.push(...data.products);
      if (!data.hasMore) break;
    }
    return all;
  },
  async product(id) {
    const data = await api<{ product: WireProduct }>('GET', `/products/${encodeURIComponent(id)}`, undefined, { auth: true });
    return product(data.product);
  },
};
