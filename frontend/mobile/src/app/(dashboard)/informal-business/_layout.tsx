import { Stack } from 'expo-router';

import { colors } from '@/shared/theme/tokens';

export const unstable_settings = {
  // Deep links into a feature still get the tabs underneath for Back.
  initialRouteName: '(tabs)',
};

/**
 * Informal business: the four tabs, plus one folder per feature
 * (credit-book, jobs, ...). Each feature's screens live in
 * src/features/dashboard/informal-business/<feature>/.
 */
export default function InformalBusinessLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.porcelain } }} />;
}
