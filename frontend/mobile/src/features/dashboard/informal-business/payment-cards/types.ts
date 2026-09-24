/**
 * Saved payment cards, as the app sees them.
 *
 * CARD NUMBERS NEVER TOUCH AKAYZA (PCI DSS). A card is added on the payment
 * gateway's own secure page; the gateway keeps it and gives our server a
 * token. The server keeps that token; the app only ever sees this: brand,
 * last 4 digits, expiry. Removing a card asks the gateway to cancel the token.
 */
export type CardBrand = 'visa' | 'mastercard';

export type SavedCard = {
  /** Our id for the card, never the gateway's token. */
  id: string;
  brand: CardBrand;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
  addedAt: string;
};

/** Outcomes the practice payment page can simulate (mock only). */
export type TestCardOutcome = 'approved' | 'declined' | 'cancelled';

export type TestCard = { id: string; brand: CardBrand; last4: string; outcome: Exclude<TestCardOutcome, 'cancelled'>; note: string };

export interface PaymentCardsApi {
  list(): Promise<SavedCard[]>;
  /**
   * Start adding a card. Real: the server asks the gateway for a secure
   * page and returns its address, opened in the in-app browser. Mock: the
   * practice page inside the app.
   */
  beginAdd(): Promise<{ sessionId: string }>;
  setDefault(id: string): Promise<void>;
  remove(id: string): Promise<void>;
}

export const BRAND_LABEL: Record<CardBrand, string> = { visa: 'Visa', mastercard: 'Mastercard' };
