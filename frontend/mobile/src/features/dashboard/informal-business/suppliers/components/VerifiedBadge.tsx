import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/shared/theme/tokens';

/** The blue tick after a verified supplier's name. */
export function VerifiedBadge({ size = 16 }: { size?: number }) {
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }]} accessibilityLabel="Verified">
      <Feather name="check" size={Math.round(size * 0.62)} color={colors.white} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
