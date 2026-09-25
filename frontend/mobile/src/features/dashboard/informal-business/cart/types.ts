import type { CategoryCode } from '@/constants/categories';
import type { Cents } from '@/shared/lib/money';

/**
 * A line in a cart. The price here is only what the trader SAW; the
 * server prices the order again from its own database when it's placed.
 */
export type CartLine = {
  productId: string;
  name: string;
  packSize: string;
  unit: string;
  category: CategoryCode;
  image: string | null;
  seenPriceCents: Cents;
  qty: number;
  maxQty: number;
};

/** One cart per supplier: one order = one supplier. */
export type Cart = { supplierId: string; lines: CartLine[] };
