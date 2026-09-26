/**
 * MOCK suppliers: fictional companies (never real businesses), shaped like
 * the backend's supplier profile (docs/supplier/03). Used by the mock
 * recommendation engine, the supplier page and the order mock.
 */
import type { CategoryCode } from '@/constants/categories';

import type { OpeningHours } from '../types';

export type MockSupplier = {
  id: string;
  name: string;
  initials: string;
  color: string;
  about: string;
  area: string;
  address: string;
  latitude: number;
  longitude: number;
  hours: OpeningHours[];
  deliveryRadiusKm: number;
  deliveryFeeCents: number;
  freeDeliveryOverCents: number | null;
  collect: boolean;
  categories: CategoryCode[];
  payfast: boolean;
  cash: boolean;
  cashLimitCents: number | null;
  minOrderCents: number;
  /** Checked by us when the supplier's system was connected (integration + documents). */
  verified: boolean;
  /** The supplier's logo (Cloudinary later); null = initials in a circle. */
  logoUrl: string | null;
};

const WEEKDAYS: OpeningHours = { days: 'Mon-Fri', open: '07:00', close: '17:00' };
const SATURDAY: OpeningHours = { days: 'Sat', open: '08:00', close: '13:00' };

export const MOCK_SUPPLIERS: MockSupplier[] = [
  {
    id: 'mw', name: 'Mahlangu Wholesale', initials: 'MW', color: '#1F2A44', area: 'Tembisa',
    about: 'Groceries, drinks and household goods for spaza shops. Delivered daily across Tembisa.',
    address: '14 Andrew Mapheto Drive, Tembisa, 1632',
    latitude: -25.999, longitude: 28.227, hours: [WEEKDAYS, SATURDAY],
    deliveryRadiusKm: 15, deliveryFeeCents: 3500, freeDeliveryOverCents: 150000, collect: true,
    categories: ['food_grocery', 'beverages', 'snacks_confectionery', 'household_cleaning', 'personal_care', 'dairy_chilled'],
    payfast: true, cash: true, cashLimitCents: 500000, minOrderCents: 50000, verified: true, logoUrl: null,
  },
  {
    id: 'dd', name: 'Dlamini Drinks', initials: 'DD', color: '#2F5D8A', area: 'Tembisa',
    about: 'Cold drinks, juices and snacks by the case.',
    address: '3 Isimuku Street, Tembisa, 1632',
    latitude: -25.985, longitude: 28.21, hours: [WEEKDAYS],
    deliveryRadiusKm: 12, deliveryFeeCents: 2500, freeDeliveryOverCents: 100000, collect: true,
    categories: ['beverages', 'snacks_confectionery'], payfast: true, cash: false, cashLimitCents: null, minOrderCents: 30000, verified: true, logoUrl: null,
  },
  {
    id: 'kb', name: 'Kasi Bakers', initials: 'KB', color: '#8A5A1E', area: 'Ivory Park',
    about: 'Fresh bread every morning, baked in Ivory Park.',
    address: '22 Mthimkhulu Street, Ivory Park, 1693',
    latitude: -25.994, longitude: 28.183, hours: [{ days: 'Mon-Sat', open: '05:00', close: '14:00' }],
    deliveryRadiusKm: 8, deliveryFeeCents: 1500, freeDeliveryOverCents: 50000, collect: true,
    categories: ['bakery'], payfast: true, cash: true, cashLimitCents: 200000, minOrderCents: 20000, verified: true, logoUrl: null,
  },
  {
    id: 'cc', name: 'Clean & Care Distributors', initials: 'CC', color: '#3B6E5A', area: 'Kempton Park',
    about: 'Cleaning, personal care and baby products at wholesale prices.',
    address: '8 Monument Road, Kempton Park, 1619',
    latitude: -26.1, longitude: 28.23, hours: [WEEKDAYS, SATURDAY],
    deliveryRadiusKm: 20, deliveryFeeCents: 5000, freeDeliveryOverCents: 200000, collect: true,
    categories: ['household_cleaning', 'personal_care', 'baby_family', 'packaging_disposable'],
    payfast: true, cash: true, cashLimitCents: 500000, minOrderCents: 80000, verified: true, logoUrl: null,
  },
  {
    id: 'nh', name: 'Ndlovu Hardware', initials: 'NH', color: '#5E5648', area: 'Tembisa',
    about: 'Building materials, plumbing, electrical and tools for builders and trades.',
    address: '51 Olifantsfontein Road, Tembisa, 1632',
    latitude: -26.01, longitude: 28.24, hours: [WEEKDAYS, SATURDAY],
    deliveryRadiusKm: 25, deliveryFeeCents: 25000, freeDeliveryOverCents: 500000, collect: true,
    categories: ['building_materials', 'tools_hardware', 'paint_finishes', 'plumbing', 'electrical'],
    payfast: true, cash: true, cashLimitCents: 1000000, minOrderCents: 100000, verified: true, logoUrl: null,
  },
  {
    id: 'mb', name: 'Midrand Build & Plumb', initials: 'MB', color: '#6B3A2E', area: 'Midrand',
    about: 'Plumbing and electrical supplies for contractors.',
    address: '120 New Road, Midrand, 1685',
    latitude: -25.99, longitude: 28.13, hours: [WEEKDAYS],
    deliveryRadiusKm: 30, deliveryFeeCents: 35000, freeDeliveryOverCents: 800000, collect: true,
    categories: ['plumbing', 'electrical', 'building_materials'], payfast: true, cash: false, cashLimitCents: null, minOrderCents: 200000, verified: true,
    // The same logo the seed feed gives this supplier (backend/seed/demo_images.csv).
    logoUrl: 'https://res.cloudinary.com/f5fbqhac/image/upload/f_auto,q_auto,c_limit,w_200/v1790425123/akayza-dev/demo/suppliers/midrand-build-and-plumb.jpg',
  },
  {
    id: 'sw', name: 'Soweto Cash & Carry', initials: 'SC', color: '#4A4E8A', area: 'Soweto',
    about: 'Groceries, drinks and snacks for Soweto traders.',
    address: '9 Chris Hani Road, Soweto, 1818',
    latitude: -26.24, longitude: 27.9, hours: [WEEKDAYS, SATURDAY],
    deliveryRadiusKm: 20, deliveryFeeCents: 4000, freeDeliveryOverCents: 150000, collect: true,
    categories: ['food_grocery', 'beverages', 'household_cleaning', 'snacks_confectionery'],
    payfast: true, cash: true, cashLimitCents: 400000, minOrderCents: 40000, verified: true,
    logoUrl: 'https://res.cloudinary.com/f5fbqhac/image/upload/f_auto,q_auto,c_limit,w_200/v1790425129/akayza-dev/demo/suppliers/soweto-cash-and-carry.jpg',
  },
];

export function findMockSupplier(id: string): MockSupplier | undefined {
  return MOCK_SUPPLIERS.find((s) => s.id === id);
}
