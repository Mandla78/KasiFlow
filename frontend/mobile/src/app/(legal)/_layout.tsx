import { Stack } from 'expo-router';

import { colors } from '@/shared/theme/tokens';

/** Legal pages: open to everyone, signed in or not. */
export default function LegalLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.porcelain } }} />;
}
