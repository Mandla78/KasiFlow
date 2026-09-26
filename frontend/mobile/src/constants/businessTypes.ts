/**
 * Business types and trades. Options only, never free text: a typed
 * "other" can't be matched to suppliers and invites bias in how we treat
 * one trader against another.
 *
 * The type sets DEFAULTS (tools, pre-picked categories). It never locks
 * anything; the trader can change all of it.
 */
import { Feather } from '@expo/vector-icons';
import { ComponentProps } from 'react';

import { CategoryCode } from './categories';

type IconName = ComponentProps<typeof Feather>['name'];

export type BusinessType = 'builder' | 'spaza' | 'food' | 'other';

export type TradeKey = 'general_builder' | 'plumber' | 'electrician' | 'carpenter' | 'painter_tiler' | 'other_trade';

export type ToolKey = 'creditBook' | 'orderStock' | 'myRecord' | 'jobs' | 'orderBook';

type TypeConfig = {
  label: string;
  subtitle: string;
  icon: IconName;
  tools: Record<ToolKey, boolean>;
  /** Pre-ticked on "What do you buy?". */
  categories: CategoryCode[];
};

// Order matters: builders first.
export const BUSINESS_TYPES: Record<BusinessType, TypeConfig> = {
  builder: {
    label: 'Builder / trade',
    subtitle: 'Building, plumbing, electrical and other trades',
    icon: 'tool',
    tools: { creditBook: false, orderStock: true, myRecord: true, jobs: true, orderBook: false },
    categories: ['building_materials', 'plumbing', 'electrical', 'tools_hardware', 'paint_finishes'],
  },
  spaza: {
    label: 'Spaza shop',
    subtitle: 'A shop selling groceries and everyday goods',
    icon: 'shopping-bag',
    tools: { creditBook: true, orderStock: true, myRecord: true, jobs: false, orderBook: false },
    categories: ['food_grocery', 'beverages', 'snacks_confectionery', 'household_cleaning', 'personal_care'],
  },
  food: {
    label: 'Food seller',
    subtitle: 'Kotas, plates, burgers, a food stall',
    icon: 'coffee',
    tools: { creditBook: true, orderStock: true, myRecord: true, jobs: false, orderBook: true },
    categories: ['bakery', 'meat_frozen', 'dairy_chilled', 'beverages', 'packaging_disposable', 'fresh_produce', 'food_grocery'],
  },
  other: {
    label: 'Other',
    subtitle: 'Another kind of small business',
    icon: 'grid',
    tools: { creditBook: true, orderStock: true, myRecord: true, jobs: false, orderBook: false },
    categories: [],
  },
};

export const BUSINESS_TYPE_ORDER: BusinessType[] = ['builder', 'spaza', 'food', 'other'];

export const TRADES: { key: TradeKey; label: string; categories: CategoryCode[] }[] = [
  { key: 'general_builder', label: 'General builder', categories: ['building_materials', 'tools_hardware', 'paint_finishes', 'plumbing', 'electrical'] },
  { key: 'plumber', label: 'Plumber', categories: ['plumbing', 'tools_hardware', 'building_materials'] },
  { key: 'electrician', label: 'Electrician', categories: ['electrical', 'tools_hardware'] },
  { key: 'carpenter', label: 'Carpenter', categories: ['building_materials', 'tools_hardware', 'paint_finishes'] },
  { key: 'painter_tiler', label: 'Painter / tiler', categories: ['paint_finishes', 'building_materials', 'tools_hardware'] },
  { key: 'other_trade', label: 'Other trade', categories: ['tools_hardware', 'building_materials'] },
];

export function defaultCategories(type: BusinessType, trade?: TradeKey | null): CategoryCode[] {
  if (type === 'builder' && trade) return TRADES.find((t) => t.key === trade)?.categories ?? BUSINESS_TYPES.builder.categories;
  return BUSINESS_TYPES[type].categories;
}
