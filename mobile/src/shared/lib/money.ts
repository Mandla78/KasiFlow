/**
 * Money is integer cents everywhere, same as the backend finance engine.
 * Never do arithmetic on the formatted string.
 */
export type Cents = number;

export function formatRand(cents: Cents): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const rands = Math.floor(abs / 100);
  const rest = abs % 100;
  const whole = rands.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const body = rest === 0 ? whole : `${whole}.${rest.toString().padStart(2, '0')}`;
  return `${negative ? '-' : ''}R${body}`;
}
