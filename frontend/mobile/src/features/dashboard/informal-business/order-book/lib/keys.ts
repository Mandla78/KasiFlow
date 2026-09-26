/**
 * An order's key: a v4 UUID the phone makes when the order is taken (the
 * server only accepts UUIDs). crypto.randomUUID when the phone has it;
 * Hermes often doesn't, so otherwise Math.random in the same shape. The
 * key is an address, not a secret: the server always looks it up together
 * with the signed-in trader.
 */
export function newOrderKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return randomKey();
}

/** Exported for the tests: the fallback, always. */
export function randomKey(): string {
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16));
  hex[12] = 4; // version 4
  hex[16] = (hex[16]! & 0x3) | 0x8; // RFC 4122 variant
  const s = hex.map((n) => n.toString(16)).join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
