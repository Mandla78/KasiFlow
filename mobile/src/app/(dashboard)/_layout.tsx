import { Stack } from 'expo-router';

import { useSession } from '@/features/auth/session/SessionProvider';
import { colors } from '@/shared/theme/tokens';

/**
 * One folder per kind of business. Each opens its own tabs and features.
 * A formal-business dashboard slots in here as a third folder later.
 */
export default function DashboardLayout() {
  const { profile } = useSession();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.porcelain } }}>
      <Stack.Protected guard={profile.dashboard === 'informal-business'}>
        <Stack.Screen name="informal-business" />
      </Stack.Protected>
      <Stack.Protected guard={profile.dashboard === 'supplier'}>
        <Stack.Screen name="supplier" />
      </Stack.Protected>
    </Stack>
  );
}
