/**
 * MOCK payment cards: to try the add / make default / remove flows before
 * the gateway is connected. Kept on the phone (secure storage) so the list
 * survives a restart. It holds only what the real app will hold: brand,
 * last 4, expiry. No card numbers, here or anywhere in the app.
 *
 * When the gateway lands, an httpPaymentCardsApi implements the same
 * PaymentCardsApi, and beginAdd returns the gateway's secure page instead
 * of opening the practice page.
 */
import * as SecureStore from 'expo-secure-store';

import { PaymentCardsApi, SavedCard, TestCard, TestCardOutcome } from '../types';

const KEY = 'akayza.mock-cards.v1';
const wait = (ms = 400) => new Promise((r) => setTimeout(r, ms));

/** What the practice page offers. Last 4 only: it's a picker, not a card form. */
export const TEST_CARDS: TestCard[] = [
  { id: 'visa-ok', brand: 'visa', last4: '4242', outcome: 'approved', note: 'Card is saved' },
  { id: 'mc-ok', brand: 'mastercard', last4: '4444', outcome: 'approved', note: 'Card is saved' },
  { id: 'visa-declined', brand: 'visa', last4: '0002', outcome: 'declined', note: 'Bank declines the card' },
];

let cards: SavedCard[] | null = null;
const sessions = new Set<string>();

async function load(): Promise<SavedCard[]> {
  if (cards) return cards;
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    cards = raw ? (JSON.parse(raw) as SavedCard[]) : [];
  } catch {
    cards = []; // web preview: memory only
  }
  return cards;
}

async function save(next: SavedCard[]) {
  cards = next;
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(next));
  } catch {
    // web preview
  }
}

export const mockPaymentCardsApi: PaymentCardsApi = {
  async list() {
    await wait();
    return [...(await load())];
  },

  async beginAdd() {
    await wait(200);
    const sessionId = `test-${Date.now()}`;
    sessions.add(sessionId);
    return { sessionId };
  },

  async setDefault(id) {
    await wait();
    await save((await load()).map((c) => ({ ...c, isDefault: c.id === id })));
  },

  async remove(id) {
    await wait();
    const left = (await load()).filter((c) => c.id !== id);
    if (left.length && !left.some((c) => c.isDefault)) left[0] = { ...left[0], isDefault: true };
    await save(left);
  },
};

/**
 * What the gateway would tell our server after its secure page (mock only).
 * Real life: the gateway's signed notification to the backend, never the app.
 */
export async function completeTestPayment(sessionId: string, cardId: string | null): Promise<TestCardOutcome> {
  await wait(900);
  if (!sessions.delete(sessionId)) throw new Error('This page has expired. Start again.');
  const test = TEST_CARDS.find((c) => c.id === cardId);
  if (!test) return 'cancelled';
  if (test.outcome === 'declined') return 'declined';
  const now = new Date();
  const existing = await load();
  const card: SavedCard = {
    id: `card-${now.getTime()}`,
    brand: test.brand,
    last4: test.last4,
    expMonth: now.getMonth() + 1,
    expYear: now.getFullYear() + 3,
    isDefault: existing.length === 0,
    addedAt: now.toISOString(),
  };
  await save([...existing, card]);
  return 'approved';
}
