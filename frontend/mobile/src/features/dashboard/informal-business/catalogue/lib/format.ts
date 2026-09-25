import { formatRand } from '@/shared/lib/money';

import type { Product } from '../types';

/** "R89.99 / bag of 10 kg" */
export function priceLine(p: Pick<Product, 'priceCents' | 'unit' | 'packSize'>): string {
  return `${formatRand(p.priceCents)} / ${p.unit}`;
}

export const STOCK_LABEL = { in_stock: 'In stock', low: 'Only a few left', out: 'Out of stock' } as const;
