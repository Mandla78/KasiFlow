/**
 * The 22 product categories (docs/plan/04_BUSINESS_TYPES.txt section 4).
 * Frozen: the backend validates against the same codes, and the supplier
 * engine matches traders to suppliers on them. Change both together.
 */
import { Feather } from '@expo/vector-icons';
import { ComponentProps } from 'react';

type IconName = ComponentProps<typeof Feather>['name'];

export type CategoryCode =
  | 'food_grocery'
  | 'beverages'
  | 'snacks_confectionery'
  | 'bakery'
  | 'dairy_chilled'
  | 'fresh_produce'
  | 'meat_frozen'
  | 'household_cleaning'
  | 'personal_care'
  | 'baby_family'
  | 'packaging_disposable'
  | 'stationery_school'
  | 'clothing_apparel'
  | 'airtime_electricity'
  | 'fragrances_beauty'
  | 'phone_accessories'
  | 'building_materials'
  | 'plumbing'
  | 'electrical'
  | 'tools_hardware'
  | 'paint_finishes'
  | 'other';

export type Category = { code: CategoryCode; label: string; icon: IconName; group: 'shop' | 'build' | 'resell' | 'other' };

export const CATEGORIES: Category[] = [
  { code: 'food_grocery', label: 'Food & Grocery', icon: 'shopping-bag', group: 'shop' },
  { code: 'beverages', label: 'Beverages', icon: 'coffee', group: 'shop' },
  { code: 'snacks_confectionery', label: 'Snacks & Sweets', icon: 'gift', group: 'shop' },
  { code: 'bakery', label: 'Bakery', icon: 'sun', group: 'shop' },
  { code: 'dairy_chilled', label: 'Dairy & Chilled', icon: 'droplet', group: 'shop' },
  { code: 'fresh_produce', label: 'Fresh Produce', icon: 'feather', group: 'shop' },
  { code: 'meat_frozen', label: 'Meat & Frozen', icon: 'thermometer', group: 'shop' },
  { code: 'household_cleaning', label: 'Household & Cleaning', icon: 'home', group: 'shop' },
  { code: 'personal_care', label: 'Personal Care', icon: 'smile', group: 'shop' },
  { code: 'baby_family', label: 'Baby & Family', icon: 'heart', group: 'shop' },
  { code: 'packaging_disposable', label: 'Packaging & Disposables', icon: 'package', group: 'shop' },
  { code: 'airtime_electricity', label: 'Airtime & Electricity', icon: 'zap', group: 'shop' },
  { code: 'stationery_school', label: 'Stationery & School', icon: 'edit-3', group: 'resell' },
  { code: 'clothing_apparel', label: 'Clothing & Apparel', icon: 'shopping-cart', group: 'resell' },
  { code: 'fragrances_beauty', label: 'Fragrances & Beauty', icon: 'star', group: 'resell' },
  { code: 'phone_accessories', label: 'Phone Accessories', icon: 'smartphone', group: 'resell' },
  { code: 'building_materials', label: 'Building Materials', icon: 'layers', group: 'build' },
  { code: 'plumbing', label: 'Plumbing', icon: 'git-merge', group: 'build' },
  { code: 'electrical', label: 'Electrical', icon: 'zap-off', group: 'build' },
  { code: 'tools_hardware', label: 'Tools & Hardware', icon: 'tool', group: 'build' },
  { code: 'paint_finishes', label: 'Paint & Finishes', icon: 'droplet', group: 'build' },
  { code: 'other', label: 'Other', icon: 'more-horizontal', group: 'other' },
];

export const categoryByCode = (code: CategoryCode) => CATEGORIES.find((c) => c.code === code)!;
