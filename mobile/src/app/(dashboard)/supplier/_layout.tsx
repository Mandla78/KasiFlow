import { Stack } from 'expo-router';

import { colors } from '@/shared/theme/tokens';

/**
 * Supplier dashboard. Suppliers are connected through the backend (ERP
 * integration) for the hackathon, so this is a placeholder folder; its
 * features live in src/features/dashboard/supplier/<feature>/.
 */
export default function SupplierLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.porcelain } }} />;
}
