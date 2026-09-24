import { Stack } from 'expo-router';

import { colors } from '@/shared/theme/tokens';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.porcelain } }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="google"
        options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }}
      />
    </Stack>
  );
}
