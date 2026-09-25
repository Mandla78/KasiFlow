/**
 * The numbers Home still can't read from the trader's own tools: they come
 * from ORDERS (Mandla's side: what you owe suppliers, deliveries) or from
 * the daily tally (not built). Shown with a "Sample" mark until they're
 * real. Everything else on Home is live. All money in cents.
 */
import { Cents } from '@/shared/lib/money';

import { TodayItem } from './lib/today';

export const spazaSample = {
  youOweSuppliers: 234000 as Cents,
  cashInToday: 112000 as Cents,
};

export const builderSample = {
  youOweHardware: 486000 as Cents,
};

export const spazaSampleToday: TodayItem[] = [
  {
    id: 'sample-delivery',
    icon: 'truck',
    tint: 'marigold',
    title: 'Delivery on its way',
    subtitle: 'Mahlangu Wholesale · 4 items',
    amount: 234000,
    tag: { label: 'Pay cash on delivery', tone: 'marigold' },
    sample: true,
  },
];

export const builderSampleToday: TodayItem[] = [
  { id: 'sample-materials', icon: 'truck', tint: 'jade', title: 'Materials on the way', subtitle: 'Ndlovu Hardware · paid in the app', amount: 486000, sample: true },
];
