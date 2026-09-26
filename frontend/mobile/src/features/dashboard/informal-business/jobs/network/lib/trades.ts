/**
 * The trades in the builder network, and which ones work together. The
 * list is the app's one list of trades (constants/businessTypes.ts, from
 * QUESTION_trades.txt, approved): sign-up picks one, the builder profile
 * up to three.
 */
import { TRADES as ALL_TRADES, TradeKey } from '@/constants/businessTypes';

export type Trade = TradeKey;

export const TRADES: { key: Trade; label: string }[] = ALL_TRADES.map(({ key, label }) => ({ key, label }));

export function tradeLabel(trade: Trade): string {
  return TRADES.find((t) => t.key === trade)?.label ?? 'Builder';
}

/** "Plumber", "Plumber and tiler", "Roofer, carpenter and welder". */
export function tradesText(trades: Trade[]): string {
  const [first, ...rest] = trades.map(tradeLabel);
  if (!first) return 'Builder';
  if (rest.length === 0) return first;
  const lower = rest.map((l) => l.toLowerCase());
  const last = lower.pop();
  return lower.length ? `${first}, ${lower.join(', ')} and ${last}` : `${first} and ${last}`;
}

/**
 * Trades that finish each other's work on one house: the general builder
 * needs all of them; the roofer needs the carpenter and the welder; the
 * tiler follows the plumber. Symmetric.
 */
const WORKS_WITH: Record<Trade, Trade[]> = {
  general_builder: ['bricklayer', 'plumber', 'electrician', 'carpenter', 'roofer', 'tiler', 'painter', 'welder', 'glazier'],
  bricklayer: ['general_builder', 'plumber', 'electrician', 'carpenter', 'roofer'],
  plumber: ['general_builder', 'bricklayer', 'electrician', 'tiler'],
  electrician: ['general_builder', 'bricklayer', 'plumber', 'carpenter'],
  carpenter: ['general_builder', 'bricklayer', 'electrician', 'roofer', 'painter', 'glazier'],
  roofer: ['general_builder', 'bricklayer', 'carpenter', 'welder'],
  tiler: ['general_builder', 'plumber', 'painter'],
  painter: ['general_builder', 'carpenter', 'tiler', 'glazier'],
  welder: ['general_builder', 'roofer', 'glazier'],
  glazier: ['general_builder', 'carpenter', 'painter', 'welder'],
  other_trade: [],
};

/**
 * Trade fit, out of 30 (15_JOBS_BUILDER_NETWORK_PLAN.txt §6):
 * trades that work together 30, the same trade 15 (overflow work), else 5.
 */
export function tradeFit(mine: Trade[], theirs: Trade[]): number {
  let best = 0;
  for (const a of mine) {
    for (const b of theirs) {
      const fit = WORKS_WITH[a].includes(b) ? 30 : a === b ? 15 : 5;
      best = Math.max(best, fit);
    }
  }
  return best;
}

/** The sign-up trade as the builder profile's first trade. */
export function fromSignUpTrade(trade: TradeKey | null | undefined): Trade[] {
  return [trade ?? 'general_builder'];
}
