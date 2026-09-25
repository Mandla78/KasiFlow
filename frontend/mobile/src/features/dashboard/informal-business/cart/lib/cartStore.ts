/**
 * The carts, one per supplier, kept in memory on the phone. Any screen can
 * read them with useCart(supplierId) / useCartCount(); only these functions
 * change them. Totals here are ESTIMATES: the server re-prices every order.
 */
import { useSyncExternalStore } from 'react';

import type { Cents } from '@/shared/lib/money';

import type { Cart, CartLine } from '../types';

type Carts = Record<string, CartLine[]>;

let carts: Carts = {};
const listeners = new Set<() => void>();

function emit(next: Carts) {
  carts = next;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Set a line's quantity (0 removes it). */
export function setLine(supplierId: string, line: Omit<CartLine, 'qty'>, qty: number) {
  const lines = carts[supplierId] ?? [];
  const q = Math.max(0, Math.min(line.maxQty, Math.floor(qty)));
  const exists = lines.some((l) => l.productId === line.productId);
  let next: CartLine[];
  if (q === 0) next = lines.filter((l) => l.productId !== line.productId);
  else if (exists) next = lines.map((l) => (l.productId === line.productId ? { ...line, qty: q } : l));
  else next = [...lines, { ...line, qty: q }];
  emit({ ...carts, [supplierId]: next });
}

export function clearCart(supplierId: string) {
  const next = { ...carts };
  delete next[supplierId];
  emit(next);
}

export function estimatedTotal(lines: CartLine[]): Cents {
  return lines.reduce((sum, l) => sum + l.seenPriceCents * l.qty, 0);
}

export function itemCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.qty, 0);
}

export function useCart(supplierId: string): Cart {
  const lines = useSyncExternalStore(subscribe, () => carts[supplierId] ?? EMPTY);
  return { supplierId, lines };
}

const EMPTY: CartLine[] = [];

/** Suppliers that have something in their cart (for the cart icon and Your carts). */
export function useCartSupplierIds(): string[] {
  const all = useSyncExternalStore(subscribe, () => carts);
  return Object.keys(all).filter((id) => all[id].length > 0);
}
