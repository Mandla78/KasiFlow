/**
 * The order book (docs/teammate/14_ROUND_2_BRIEF.txt §2): CUSTOMER orders
 * at a counter -- kota shops, food stalls. Fast and clear for a queue of
 * hungry people and one person cooking and taking money. Not orders to
 * suppliers (that's "Order stock"). Field names are the camelCase twins of
 * the proposed API (docs/teammate/feedback/CONTRACT_order_book.txt).
 *
 * Money is integer cents; days are ISO dates (South Africa's today).
 */
import type { Cents } from '@/shared/lib/money';

/** What goes into an item: feeds the supplier engine (what you'll need to restock). */
export type Ingredient =
  | 'quarter_loaf'
  | 'bun'
  | 'chips'
  | 'polony'
  | 'russian'
  | 'vienna'
  | 'cheese'
  | 'egg'
  | 'atchar'
  | 'lettuce'
  | 'beef_patty'
  | 'chicken'
  | 'wors'
  | 'pap'
  | 'stew'
  | 'chakalaka'
  | 'vetkoek'
  | 'mince'
  | 'cold_drink';

export type MenuItem = {
  id: string;
  name: string;
  priceCents: Cents;
  ingredients: Ingredient[];
};

export type MenuItemInput = Omit<MenuItem, 'id'> & { id?: string };

/**
 * new        taken, not started
 * preparing  being made
 * ready      waiting at the counter
 * collected  done
 * cancelled  never made (a mistake, or they left)
 */
export type OrderStatus = 'new' | 'preparing' | 'ready' | 'collected' | 'cancelled';

/** cash, card or EFT, or pay later (the credit book). */
export type Payment = 'cash' | 'digital' | 'later';

/** A line as it was sold: the name and price are a snapshot (a menu change never changes it). */
export type OrderLine = { itemId: string; name: string; priceCents: Cents; qty: number };

export type Order = {
  /** The phone's key for the order (a UUID): the same on every retry, so it lands once. */
  id: string;
  /** The day's number from the server (#1, #2...); null until the server has it. */
  number: number | null;
  /** What the phone calls it until then: "A3" (this phone's letter + its own count). */
  tempNumber: string;
  day: string;
  lines: OrderLine[];
  totalCents: Cents;
  payment: Payment;
  /** Optional, for the queue only ("Thabo's order"). Never a phone number. */
  customerName: string | null;
  status: OrderStatus;
  createdAt: string;
  statusAt: string;
};

export type NewOrder = {
  id: string;
  day: string;
  tempNumber: string;
  lines: { itemId: string; qty: number }[];
  payment: Payment;
  customerName: string | null;
  createdAt: string;
};

/** One day in numbers. */
export type DayTotals = {
  day: string;
  orders: number;
  cashCents: Cents;
  digitalCents: Cents;
  laterCents: Cents;
  bestSellers: { name: string; qty: number }[];
  /** Orders per hour of the day (index 0..23). */
  byHour: number[];
};

export interface OrderBookApi {
  menu(): Promise<MenuItem[]>;
  /** The whole menu, as it should be now (new items have no id). */
  saveMenu(items: MenuItemInput[]): Promise<MenuItem[]>;
  /** The server's orders of a day (not cancelled ones' money, but the orders themselves). */
  orders(day: string): Promise<Order[]>;
  /** Idempotent on order.id: a retry returns the same order with the same number. */
  create(order: NewOrder): Promise<Order>;
  setStatus(orderId: string, status: OrderStatus, at: string): Promise<Order>;
  /** The 7 days ending on endDay, oldest first. */
  week(endDay: string): Promise<DayTotals[]>;
}
