/**
 * Orders on the server (/me/orders). snake_case on the wire is mapped to
 * the app's camelCase here and nowhere else. The server prices every
 * order; its refusals (below the minimum, out of stock, cash limit, not
 * connected...) come back as OrderError with its own message.
 */
import { api, ApiError } from '@/shared/api/client';

import { Evidence, MoneySummary, Order, OrderError, OrdersApi, OrderStatus, PaymentMethod, PaymentStatus } from '../types';

type WireOrder = {
  id: string;
  reference: string;
  supplier_id: string;
  supplier_name: string;
  status: OrderStatus;
  payment: PaymentMethod;
  payment_status: PaymentStatus;
  fulfilment: Order['fulfilment'];
  address: string;
  lines: { product_id: string; name: string; pack_size: string; unit: string; qty: number; price_cents: number; line_total_cents: number }[];
  subtotal_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
  placed_at: string;
  pay_by: string | null;
  events: { status: OrderStatus; at: string }[];
  documents: { invoice: boolean; receipt: boolean };
  evidence: Evidence;
};

export function orderFromWire(o: WireOrder): Order {
  return {
    id: o.id,
    reference: o.reference,
    supplierId: o.supplier_id,
    supplierName: o.supplier_name,
    status: o.status,
    payment: o.payment,
    paymentStatus: o.payment_status,
    fulfilment: o.fulfilment,
    address: o.address,
    lines: o.lines.map((l) => ({
      productId: l.product_id,
      name: l.name,
      packSize: l.pack_size,
      unit: l.unit,
      qty: l.qty,
      priceCents: l.price_cents,
      lineTotalCents: l.line_total_cents,
    })),
    subtotalCents: o.subtotal_cents,
    deliveryFeeCents: o.delivery_fee_cents,
    totalCents: o.total_cents,
    placedAt: o.placed_at,
    payBy: o.pay_by,
    events: o.events,
    documents: o.documents,
    evidence: o.evidence,
  };
}

/** The server said no for a reason the trader can act on: show its message. */
async function orCallError<T>(call: Promise<T>): Promise<T> {
  try {
    return await call;
  } catch (e) {
    // A reason from our server (4xx, or a 503 like "payments not ready"): show it.
    // Network failures and sign-in expiry keep their own handling.
    if (e instanceof ApiError && e.status >= 400 && e.status !== 401 && e.code !== 'NETWORK' && e.code !== 'BAD_RESPONSE') throw new OrderError(e.code, e.message);
    throw e;
  }
}

export const httpOrdersApi: OrdersApi = {
  async place(input) {
    const data = await orCallError(
      api<{ order: WireOrder }>(
        'POST',
        '/me/orders',
        {
          supplier_id: input.supplierId,
          lines: input.lines.map((l) => ({ product_id: l.productId, qty: l.qty })),
          fulfilment: input.fulfilment,
          payment: input.payment,
          delivery_address: input.deliveryPoint ? input.deliveryAddress : null,
          delivery_point: input.deliveryPoint ?? null,
        },
        { auth: true, headers: input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey } : undefined },
      ),
    );
    return orderFromWire(data.order);
  },
  async list() {
    const data = await api<{ orders: WireOrder[] }>('GET', '/me/orders', undefined, { auth: true });
    return data.orders.map(orderFromWire);
  },
  async get(id) {
    const data = await orCallError(api<{ order: WireOrder }>('GET', `/me/orders/${encodeURIComponent(id)}`, undefined, { auth: true }));
    return orderFromWire(data.order);
  },
  async summary(): Promise<MoneySummary> {
    const { summary: s } = await api<{
      summary: {
        provider_verified_cents: number;
        provider_verified_orders: number;
        confirmed_by_both_cents: number;
        confirmed_by_both_orders: number;
        not_confirmed_cents: number;
        not_confirmed_orders: number;
      };
    }>('GET', '/me/orders/summary', undefined, { auth: true });
    return {
      providerVerifiedCents: s.provider_verified_cents,
      providerVerifiedOrders: s.provider_verified_orders,
      confirmedByBothCents: s.confirmed_by_both_cents,
      confirmedByBothOrders: s.confirmed_by_both_orders,
      notConfirmedCents: s.not_confirmed_cents,
      notConfirmedOrders: s.not_confirmed_orders,
    };
  },
  async documentLink(id, kind) {
    const data = await orCallError(api<{ url: string }>('POST', `/me/orders/${encodeURIComponent(id)}/documents/${kind}`, undefined, { auth: true }));
    return data.url;
  },
  async startPayment(id) {
    const data = await orCallError(api<{ pay_url: string }>('POST', `/me/orders/${encodeURIComponent(id)}/pay`, undefined, { auth: true }));
    return data.pay_url;
  },
  async cancel(id) {
    const data = await orCallError(api<{ order: WireOrder }>('POST', `/me/orders/${encodeURIComponent(id)}/cancel`, undefined, { auth: true }));
    return orderFromWire(data.order);
  },
};
