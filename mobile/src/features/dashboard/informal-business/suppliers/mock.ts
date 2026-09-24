/**
 * Sample data for the Suppliers tab, shaped like the UX design. Replaced when the
 * backend endpoint lands. All money in cents.
 */

export type Supplier = {
  id: string;
  initials: string;
  color: string;
  name: string;
  line: string;
  payfast: boolean;
  cash: boolean;
  categories: string[];
  yours: boolean;
};

export const suppliers: Supplier[] = [
  { id: 'mw', initials: 'MW', color: '#1F2A44', name: 'Mahlangu Wholesale', line: 'Groceries · Tembisa · delivers in 1 day', payfast: true, cash: true, categories: ['Groceries'], yours: true },
  { id: 'dd', initials: 'DD', color: '#2F5D8A', name: 'Dlamini Drinks', line: 'Cold drinks · Tembisa · same day', payfast: true, cash: false, categories: ['Drinks'], yours: true },
  { id: 'kb', initials: 'KB', color: '#8A5A1E', name: 'Kasi Bakers', line: 'Bread · Ivory Park · daily', payfast: true, cash: false, categories: ['Groceries'], yours: false },
  { id: 'nh', initials: 'NH', color: '#5E5648', name: 'Ndlovu Hardware', line: 'Building · Tembisa', payfast: true, cash: false, categories: ['Building'], yours: false },
];
