/**
 * A checkbox with a label. The BOX is the toggle (with a generous hit
 * area); the label is plain content, so links inside it (e.g. Privacy
 * Policy) open the link instead of ticking the box by accident.
 */
import { Feather } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors } from '@/shared/theme/tokens';

export function Checkbox({
  checked,
  onChange,
  children,
  error,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  error?: boolean;
  /** Accessible name for the box, since its visible label may contain links. */
  label: string;
}) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        onPress={() => onChange(!checked)}
        hitSlop={14}
        style={[styles.box, checked && styles.boxOn, error && !checked && { borderColor: colors.garnet }]}>
        {checked ? <Feather name="check" size={14} color={colors.white} /> : null}
      </Pressable>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.textFaint,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
});
