import { ComingSoon } from '@/shared/components/ComingSoon';

/** Supplier dashboard home. Suppliers use the backend integration for now; this is where their app screens go later. */
export default function SupplierHomeScreen() {
  return (
    <ComingSoon
      title="Supplier"
      icon="truck"
      back={false}
      message="Orders from traders, deliveries and cash confirmations. Suppliers connect through their own system for now."
    />
  );
}
