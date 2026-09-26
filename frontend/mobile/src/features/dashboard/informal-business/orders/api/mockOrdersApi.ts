/**
 * MOCK orders, doing what the server will (docs/supplier/04):
 *  - prices every line from the CATALOGUE, never from the cart (the active
 *    one: the server's when EXPO_PUBLIC_USE_MOCK_API=false, else the mock)
 *  - enforces the supplier's minimum order, what it accepts, and the cash
 *    rules (R1,000 per order, 2 waiting at a time: ../lib/cashPolicy)
 *  - adds the delivery fee unless the order is over the free-delivery total
 * Digital payment: the order waits for payment and nothing reaches the
 * supplier until it's paid (the payment step comes with the payment
 * provider). Cash: the order goes to the supplier and waits for them to
 * accept.
 * Cash orders then move on by themselves so the whole flow can be shown
 * without a backend: accepted after 20 s -> on its way / ready after 60 s
 * -> delivered / collected after 120 s, each with an in-app notification.
 */
import { formatRand } from '@/shared/lib/money';

import { notify } from '../../notifications/lib/notificationStore';
import { catalogueApi } from '../../catalogue/api/catalogueApi';
import type { Product } from '../../catalogue/types';
import { supplierApi } from '../../suppliers/api/supplierApi';
import type { Supplier } from '../../suppliers/types';
import { cashLimitFor, MAX_OPEN_CASH_ORDERS } from '../lib/cashPolicy';
import { isActive } from '../lib/status';
import { Order, OrderError, OrderEvent, OrderLine, OrdersApi, OrderStatus } from '../types';

const wait = (ms = 500) => new Promise((r) => setTimeout(r, ms));

let orders: Order[] = [];
let nextNumber = 101;

const STEPS_SECONDS = { accepted: 20, moving: 60, done: 120 };

/** The status right now, from how long ago it was placed. */
function advanced(o: Order): Order {
  if (o.status === 'cancelled' || o.status === 'rejected' || o.status === 'awaiting_payment') return o;
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
  const paymentStatus = o.payment === 'in_app' ? o.paymentStatus : status === 'delivered' || status === 'collected' ? 'confirmed_by_both' : 'cash_due';
  return { ...o, status, events, paymentStatus };
}

/** In-app notifications as the order moves (the backend also emails them). */
function announce(o: Order) {
  const href = `/informal-business/orders/${o.id}`;
  const total = formatRand(o.totalCents);
  if (o.status === 'awaiting_payment') {
    notify({ icon: 'credit-card', title: 'Your order is waiting for payment', body: `${o.reference} · ${total} to ${o.supplierName}. Pay to send it to them.`, href });
    return;
  }
  notify({ icon: 'send', title: `Order sent to ${o.supplierName}`, body: `${o.reference} · ${total}. Waiting for them to accept.`, href });
  const collect = o.fulfilment === 'collect';
  const later: [number, OrderStatus, string, string][] = [
    [STEPS_SECONDS.accepted, 'accepted', 'check-circle', `${o.supplierName} accepted your order`],
    [STEPS_SECONDS.moving, collect ? 'ready_for_collection' : 'out_for_delivery', collect ? 'package' : 'truck', collect ? 'Your order is ready to collect' : 'Your order is on its way'],
    [STEPS_SECONDS.done, collect ? 'collected' : 'delivered', 'check', collect ? 'Order collected' : 'Order delivered'],
  ];
  for (const [seconds, status, icon, title] of later) {
    setTimeout(() => {
      const now = orders.find((x) => x.id === o.id);
      if (!now || advanced(now).status !== status) return; // cancelled meanwhile
      const cash = o.payment !== 'cash' ? '' : status === 'out_for_delivery' ? ` Have ${total} cash ready.` : status === 'ready_for_collection' ? ` Bring ${total} cash.` : '';
      notify({ icon, title, body: `${o.reference} · ${o.supplierName}.${cash}`, href });
    }, seconds * 1000 + 50);
  }
}

export const mockOrdersApi: OrdersApi = {
  async place(input) {
    await wait(900);
    const supplier: Supplier | null = await supplierApi.get(input.supplierId).catch(() => null);
    if (!supplier) throw new OrderError('NOT_FOUND', 'This supplier is no longer available.');
    if (input.payment === 'cash' && !supplier.cash) throw new OrderError('NOT_ACCEPTED', `${supplier.name} doesn't take cash.`);
    if (input.payment === 'in_app' && !supplier.payfast) throw new OrderError('NOT_ACCEPTED', `${supplier.name} doesn't take payment in the app.`);

    const products = await Promise.all(input.lines.map(({ productId }) => catalogueApi.product(productId).catch((): Product | null => null)));
    const lines: OrderLine[] = input.lines.map(({ productId, qty }, i) => {
      const p = products[i];
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
    const cashLimit = cashLimitFor(supplier);
    if (input.payment === 'cash' && cashLimit !== null && totalCents > cashLimit) {
      throw new OrderError('CASH_LIMIT', `Cash is up to ${formatRand(cashLimit)} per order. Pay digitally instead.`);
    }
    if (input.payment === 'cash' && orders.map(advanced).filter((o) => o.payment === 'cash' && isActive(o)).length >= MAX_OPEN_CASH_ORDERS) {
      throw new OrderError('CASH_LIMIT', `You can have ${MAX_OPEN_CASH_ORDERS} cash orders waiting at a time. Pay digitally for this one.`);
    }

    const now = new Date().toISOString();
    const order: Order = {
      id: `ord-${Date.now()}`,
      reference: `AKZ-2026-${String(nextNumber++).padStart(6, '0')}`,
      supplierId: supplier.id,
      supplierName: supplier.name,
      status: input.payment === 'in_app' ? 'awaiting_payment' : 'placed',
      payment: input.payment,
      paymentStatus: input.payment === 'in_app' ? 'unpaid' : 'cash_due',
      fulfilment: input.fulfilment,
      address: input.fulfilment === 'collect' ? supplier.address : input.deliveryAddress ?? 'Your business address',
      lines,
      subtotalCents,
      deliveryFeeCents,
      totalCents,
      placedAt: now,
      events: [{ status: input.payment === 'in_app' ? 'awaiting_payment' : 'placed', at: now }],
    };
    orders = [order, ...orders];
    announce(order);
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
    if (o.payment !== 'cash') throw new OrderError('TOO_LATE', "Orders paid digitally can't be cancelled.");
    if (advanced(o).status !== 'placed') throw new OrderError('TOO_LATE', 'The supplier already accepted this order, so it can no longer be cancelled.');
    const cancelled: Order = { ...o, status: 'cancelled', events: [...o.events, { status: 'cancelled', at: new Date().toISOString() }] };
    orders = orders.map((x) => (x.id === id ? cancelled : x));
    return cancelled;
  },

  async documentLink() {
    return null; // no documents in mock mode
  },

  async startPayment() {
    return null; // no payment provider in mock mode
  },
};
