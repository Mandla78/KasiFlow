import type { Cents } from '@/shared/lib/money';

export type Fulfilment = 'delivery' | 'collect';
export type PaymentMethod = 'in_app' | 'cash';

/** Server-owned; the app never sets these (docs/supplier/01). */
export type OrderStatus =
  /** Digital payment chosen, not paid yet: the supplier doesn't see it until it's paid. */
  | 'awaiting_payment'
  /** With the supplier's system, waiting for them to accept. */
  | 'placed'
  | 'accepted'
  | 'out_for_delivery'
  | 'ready_for_collection'
  | 'delivered'
  | 'collected'
  | 'rejected'
  | 'cancelled';

export type PaymentStatus = 'unpaid' | 'paid' | 'cash_due' | 'confirmed_by_both' | 'disputed' | 'refunded';

export type OrderLine = {
  productId: string;
  name: string;
  packSize: string;
  unit: string;
  qty: number;
  /** The server's price when the order was placed (a snapshot). */
  priceCents: Cents;
  lineTotalCents: Cents;
};

export type OrderEvent = { status: OrderStatus; at: string };

export type Order = {
  id: string;
  /** What people read and say: AKZ-2026-000123 */
  reference: string;
  supplierId: string;
  supplierName: string;
  status: OrderStatus;
  payment: PaymentMethod;
  paymentStatus: PaymentStatus;
  fulfilment: Fulfilment;
  /** Delivery address, or the supplier's address when collecting. */
  address: string;
  lines: OrderLine[];
  subtotalCents: Cents;
  deliveryFeeCents: Cents;
  totalCents: Cents;
  placedAt: string;
  events: OrderEvent[];
};

export type PlaceOrderInput = {
  supplierId: string;
  /** Products and quantities ONLY: prices come from the server. */
  lines: { productId: string; qty: number }[];
  fulfilment: Fulfilment;
  payment: PaymentMethod;
  deliveryAddress: string | null;
};

export class OrderError extends Error {
  constructor(
    public code: 'BELOW_MINIMUM' | 'OUT_OF_STOCK' | 'CASH_LIMIT' | 'NOT_ACCEPTED' | 'NOT_FOUND' | 'TOO_LATE',
    message: string,
  ) {
    super(message);
  }
}

export interface OrdersApi {
  place(input: PlaceOrderInput): Promise<Order>;
  list(): Promise<Order[]>;
  get(id: string): Promise<Order>;
  cancel(id: string): Promise<Order>;
}
