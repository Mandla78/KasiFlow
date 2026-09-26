/**
 * Starter menus, so setup takes 30 seconds, and the ingredients an item
 * can list. Prices are typical township prices (2026); the owner changes
 * them in one tap.
 */
import type { Ingredient, MenuItemInput } from '../types';

export const NAME_MAX = 40;
export const MAX_ITEMS = 40;
/** R2,000 for one item: a family platter, with room; a slipped finger is caught. */
export const MAX_PRICE_CENTS = 200_000;

export const INGREDIENTS: { key: Ingredient; label: string }[] = [
  { key: 'quarter_loaf', label: 'Quarter loaf' },
  { key: 'bun', label: 'Bun' },
  { key: 'chips', label: 'Chips' },
  { key: 'polony', label: 'Polony' },
  { key: 'russian', label: 'Russian' },
  { key: 'vienna', label: 'Vienna' },
  { key: 'cheese', label: 'Cheese' },
  { key: 'egg', label: 'Egg' },
  { key: 'atchar', label: 'Atchar' },
  { key: 'lettuce', label: 'Lettuce' },
  { key: 'beef_patty', label: 'Beef patty' },
  { key: 'chicken', label: 'Chicken' },
  { key: 'wors', label: 'Wors' },
  { key: 'pap', label: 'Pap' },
  { key: 'stew', label: 'Stew' },
  { key: 'chakalaka', label: 'Chakalaka' },
  { key: 'vetkoek', label: 'Vetkoek' },
  { key: 'mince', label: 'Mince' },
  { key: 'cold_drink', label: 'Cold drink' },
];

export function ingredientLabel(key: Ingredient): string {
  return INGREDIENTS.find((i) => i.key === key)?.label ?? key;
}

type Starter = { key: string; label: string; subtitle: string; items: MenuItemInput[] };

const item = (name: string, rand: number, ingredients: Ingredient[]): MenuItemInput => ({ name, priceCents: rand * 100, ingredients });

export const STARTERS: Starter[] = [
  {
    key: 'kota',
    label: 'Kota shop',
    subtitle: 'Kotas, chips, cold drinks',
    items: [
      item('Kota: chips, polony, cheese', 35, ['quarter_loaf', 'chips', 'polony', 'cheese', 'atchar']),
      item('Russian kota', 45, ['quarter_loaf', 'chips', 'russian', 'polony', 'cheese', 'atchar']),
      item('Full house kota', 60, ['quarter_loaf', 'chips', 'russian', 'vienna', 'polony', 'cheese', 'egg', 'atchar']),
      item('Chips small', 15, ['chips']),
      item('Chips large', 25, ['chips']),
      item('Cold drink', 12, ['cold_drink']),
    ],
  },
  {
    key: 'plates',
    label: 'Plates and pap',
    subtitle: 'Pap and wors, stew, chakalaka',
    items: [
      item('Pap and wors', 50, ['pap', 'wors', 'chakalaka']),
      item('Pap and chicken', 55, ['pap', 'chicken', 'chakalaka']),
      item('Pap and stew', 45, ['pap', 'stew']),
      item('Extra chakalaka', 10, ['chakalaka']),
      item('Cold drink', 12, ['cold_drink']),
    ],
  },
  {
    key: 'burgers',
    label: 'Burgers and vetkoek',
    subtitle: 'Burgers, vetkoek and mince, chips',
    items: [
      item('Beef burger', 40, ['bun', 'beef_patty', 'lettuce', 'cheese']),
      item('Chicken burger', 40, ['bun', 'chicken', 'lettuce']),
      item('Russian and chips', 35, ['russian', 'chips']),
      item('Vetkoek and mince', 20, ['vetkoek', 'mince']),
      item('Cold drink', 12, ['cold_drink']),
    ],
  },
];

/** A menu's rules, as the server will check them. Returns the first problem, or null. */
export function menuProblem(items: MenuItemInput[]): string | null {
  if (items.length > MAX_ITEMS) return `Up to ${MAX_ITEMS} items.`;
  const seen = new Set<string>();
  for (const it of items) {
    const name = it.name.trim();
    if (!/\p{L}/u.test(name)) return 'Give every item a name.';
    if (name.length > NAME_MAX) return `Keep names under ${NAME_MAX} characters.`;
    if (seen.has(name.toLowerCase())) return `"${name}" is on the menu twice.`;
    seen.add(name.toLowerCase());
    if (!Number.isInteger(it.priceCents) || it.priceCents <= 0 || it.priceCents > MAX_PRICE_CENTS) return `Give ${name} a price up to R2,000.`;
  }
  return null;
}
