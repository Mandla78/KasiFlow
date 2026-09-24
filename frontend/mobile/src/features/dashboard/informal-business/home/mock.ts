/**
 * Sample data for the Home tab, shaped like the UX design. Replaced when the
 * backend endpoint lands. All money in cents.
 */
import { Cents } from '@/shared/lib/money';

export const spazaHome = {
  customersOweYou: 34000 as Cents,
  customersCount: 4,
  dueToday: 4800 as Cents,
  youOweSuppliers: 234000 as Cents,
  cashInToday: 112000 as Cents,
};

export const builderHome = {
  waitingOnClients: 1200000 as Cents,
  stageNote: 'Walls stage · needs sign-off',
  activeJobs: 2,
  youOweHardware: 486000 as Cents,
};

export type TodayItem = {
  id: string;
  icon: 'truck' | 'book' | 'package' | 'tool' | 'shield';
  tint: 'marigold' | 'info' | 'jade';
  title: string;
  subtitle: string;
  amount?: Cents;
  tag?: { label: string; tone: 'marigold' | 'jade' | 'info' };
};

export const spazaToday: TodayItem[] = [
  {
    id: 'd1',
    icon: 'truck',
    tint: 'marigold',
    title: 'Delivery on its way',
    subtitle: 'Mahlangu Wholesale · 4 items',
    amount: 234000,
    tag: { label: 'Pay cash on delivery', tone: 'marigold' },
  },
  { id: 'c1', icon: 'book', tint: 'info', title: 'Thandi pays today', subtitle: 'Credit book · bread, milk', amount: 4800 },
  { id: 's1', icon: 'package', tint: 'info', title: 'Stock running low?', subtitle: 'Reorder your usual from Dlamini Drinks' },
];

export const builderToday: TodayItem[] = [
  {
    id: 'j1',
    icon: 'tool',
    tint: 'info',
    title: 'Mokoena extension',
    subtitle: 'Walls · photo taken · waiting for client',
    tag: { label: 'Sign-off', tone: 'marigold' },
  },
  { id: 'm1', icon: 'truck', tint: 'jade', title: 'Materials on the way', subtitle: 'Ndlovu Hardware · paid in the app', amount: 486000 },
  { id: 'r1', icon: 'shield', tint: 'info', title: 'House records', subtitle: '2 houses · 5 stages confirmed' },
];
