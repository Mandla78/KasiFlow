import type { Product } from '../../catalogue/types';
import type { CartLine } from '../types';

/** A product as a cart line (without the quantity). */
export function toCartLine(p: Product): Omit<CartLine, 'qty'> {
  return {
    productId: p.id,
    name: p.name,
    packSize: p.packSize,
    unit: p.unit,
    category: p.category,
    image: p.images[0] ?? null,
    seenPriceCents: p.priceCents,
    maxQty: p.maxQty,
  };
}
