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
  | 'cancelled'
  /** Digital order not paid within 24 hours: it lapsed and its stock went back. */
  | 'expired';

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
  /** Digital orders: pay before this or the order lapses. */
  payBy?: string | null;
  events: OrderEvent[];
};

export type PlaceOrderInput = {
  supplierId: string;
  /** Products and quantities ONLY: prices come from the server. */
  lines: { productId: string; qty: number }[];
  fulfilment: Fulfilment;
  payment: PaymentMethod;
  /** Only when delivering somewhere other than the business (with its pin);
   *  null = the business's own saved address. */
  deliveryAddress: string | null;
  deliveryPoint?: { latitude: number; longitude: number } | null;
  /** One per "Place order" tap, reused on a retry: never two orders. */
  idempotencyKey?: string;
};

export class OrderError extends Error {
  constructor(
    /** The server's code, e.g. BELOW_MINIMUM, OUT_OF_STOCK, CASH_LIMIT, NOT_CONNECTED, TOO_LATE. */
    public code: string,
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
  /** A secure pay link for an unpaid digital order; null where there's no
   *  payment provider (the mock). */
  startPayment(id: string): Promise<string | null>;
}
