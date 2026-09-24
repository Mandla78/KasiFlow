import { Stack } from 'expo-router';

import { colors } from '@/shared/theme/tokens';

export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.porcelain } }} />;
}
