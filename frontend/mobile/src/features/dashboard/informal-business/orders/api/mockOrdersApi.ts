/**
 * MOCK orders, doing what the server will (docs/supplier/04):
 *  - prices every line from the CATALOGUE, never from the cart
 *  - enforces the supplier's minimum order, cash limit and what it accepts
 *  - adds the delivery fee unless the order is over the free-delivery total
 * Statuses move on by themselves (from placement time) so the whole flow
 * can be shown without a backend: placed -> accepted after 20 s -> on its
 * way / ready after 60 s -> delivered / collected after 120 s.
 */
import { formatRand } from '@/shared/lib/money';

import { findMockProduct } from '../../catalogue/api/mockCatalogueData';
import { findMockSupplier } from '../../suppliers/api/mockSupplierData';
import { Order, OrderError, OrderEvent, OrderLine, OrdersApi, OrderStatus } from '../types';

const wait = (ms = 500) => new Promise((r) => setTimeout(r, ms));

let orders: Order[] = [];
let nextNumber = 101;

const STEPS_SECONDS = { accepted: 20, moving: 60, done: 120 };

/** The status right now, from how long ago it was placed. */
function advanced(o: Order): Order {
  if (o.status === 'cancelled' || o.status === 'rejected') return o;
  const placed = new Date(o.placedAt).getTime();
  const age = (Date.now() - placed) / 1000;
  const at = (s: number) => new Date(placed + s * 1000).toISOString();
  const collect = o.fulfilment === 'collect';
  const events: OrderEvent[] = [{ status: 'placed', at: o.placedAt }];
  let status: OrderStatus = 'placed';
  if (age >= STEPS_SECONDS.accepted) {
    status = 'accepted';
    events.push({ status, at: at(STEPS_SECONDS.accepted) });
  }
  if (age >= STEPS_SECONDS.moving) {
    status = collect ? 'ready_for_collection' : 'out_for_delivery';
    events.push({ status, at: at(STEPS_SECONDS.moving) });
  }
  if (age >= STEPS_SECONDS.done) {
    status = collect ? 'collected' : 'delivered';
    events.push({ status, at: at(STEPS_SECONDS.done) });
  }
  const paymentStatus = o.payment === 'in_app' ? 'paid' : status === 'delivered' || status === 'collected' ? 'confirmed_by_both' : 'cash_due';
  return { ...o, status, events, paymentStatus };
}

export const mockOrdersApi: OrdersApi = {
  async place(input) {
    await wait(900);
    const supplier = findMockSupplier(input.supplierId);
    if (!supplier) throw new OrderError('NOT_FOUND', 'This supplier is no longer available.');
    if (input.payment === 'cash' && !supplier.cash) throw new OrderError('NOT_ACCEPTED', `${supplier.name} doesn't take cash.`);
    if (input.payment === 'in_app' && !supplier.payfast) throw new OrderError('NOT_ACCEPTED', `${supplier.name} doesn't take payment in the app.`);

    const lines: OrderLine[] = input.lines.map(({ productId, qty }) => {
      const p = findMockProduct(productId);
      if (!p || p.supplierId !== supplier.id) throw new OrderError('NOT_FOUND', 'A product in your cart is no longer available.');
      if (p.stock === 'out') throw new OrderError('OUT_OF_STOCK', `${p.name} is out of stock. Remove it and try again.`);
      return { productId, name: p.name, packSize: p.packSize, unit: p.unit, qty, priceCents: p.priceCents, lineTotalCents: p.priceCents * qty };
    });
    const subtotalCents = lines.reduce((s, l) => s + l.lineTotalCents, 0);
    if (subtotalCents < supplier.minOrderCents) {
      throw new OrderError('BELOW_MINIMUM', `${supplier.name}'s minimum order is ${formatRand(supplier.minOrderCents)}.`);
    }
    const free = supplier.freeDeliveryOverCents !== null && subtotalCents >= supplier.freeDeliveryOverCents;
    const deliveryFeeCents = input.fulfilment === 'delivery' && !free ? supplier.deliveryFeeCents : 0;
    const totalCents = subtotalCents + deliveryFeeCents;
    if (input.payment === 'cash' && supplier.cashLimitCents !== null && totalCents > supplier.cashLimitCents) {
      throw new OrderError('CASH_LIMIT', `${supplier.name} takes cash up to ${formatRand(supplier.cashLimitCents)} per order. Pay in the app instead.`);
    }

    const now = new Date().toISOString();
    const order: Order = {
      id: `ord-${Date.now()}`,
      reference: `AKZ-2026-${String(nextNumber++).padStart(6, '0')}`,
      supplierId: supplier.id,
      supplierName: supplier.name,
      status: 'placed',
      payment: input.payment,
      paymentStatus: input.payment === 'in_app' ? 'paid' : 'cash_due',
      fulfilment: input.fulfilment,
      address: input.fulfilment === 'collect' ? supplier.address : input.deliveryAddress ?? '',
      lines,
      subtotalCents,
      deliveryFeeCents,
      totalCents,
      placedAt: now,
      events: [{ status: 'placed', at: now }],
    };
    orders = [order, ...orders];
    return order;
  },

  async list() {
    await wait(300);
    return orders.map(advanced);
  },

  async get(id) {
    await wait(250);
    const o = orders.find((x) => x.id === id);
    if (!o) throw new OrderError('NOT_FOUND', "We couldn't find that order.");
    return advanced(o);
  },

  async cancel(id) {
    await wait(400);
    const o = orders.find((x) => x.id === id);
    if (!o) throw new OrderError('NOT_FOUND', "We couldn't find that order.");
    if (advanced(o).status !== 'placed') throw new OrderError('TOO_LATE', 'The supplier already accepted this order, so it can no longer be cancelled here.');
    const cancelled: Order = { ...o, status: 'cancelled', events: [...o.events, { status: 'cancelled', at: new Date().toISOString() }] };
    orders = orders.map((x) => (x.id === id ? cancelled : x));
    return cancelled;
  },
};
