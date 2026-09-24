import { Feather } from '@expo/vector-icons';
import { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, sizes } from '@/shared/theme/tokens';

type Variant = 'primary' | 'secondary' | 'accent';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: ComponentProps<typeof Feather>['name'];
  leading?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
};

export function Button({ title, onPress, variant = 'primary', icon, leading, loading, disabled, compact }: Props) {
  const v = variants[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        { backgroundColor: v.bg, borderColor: v.border },
        pressed && { opacity: 0.85 },
        disabled && { opacity: 0.45 },
      ]}>
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.row}>
          {leading}
          {icon ? <Feather name={icon} size={17} color={v.fg} /> : null}
          <Text style={[styles.label, { color: v.fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const variants: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.ink, fg: colors.white, border: colors.ink },
  secondary: { bg: colors.white, fg: colors.ink, border: colors.line },
  accent: { bg: colors.accent, fg: colors.ink, border: colors.accent },
};

const styles = StyleSheet.create({
  base: {
    height: sizes.button,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  compact: { flex: 1, height: 48 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontFamily: fonts.bold, fontSize: 15.5 },
});
