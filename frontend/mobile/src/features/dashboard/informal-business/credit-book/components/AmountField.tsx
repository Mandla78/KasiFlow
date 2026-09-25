import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, fonts, radius } from '@/shared/theme/tokens';

type Props = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
  hint?: string;
  autoFocus?: boolean;
};

/** Money typed in rand, big and bold like the design ("R48"). The screen turns it into cents. */
export function AmountField({ label, value, onChangeText, error, hint, autoFocus }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.box, focused && styles.focused, !!error && styles.errored]}>
        <Text style={styles.prefix}>R</Text>
        <TextInput
          accessibilityLabel={`${label} in rand`}
          value={value}
          onChangeText={(t) => onChangeText(t.replace(/[^\d.,\s]/g, ''))}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.textFaint}
          autoFocus={autoFocus}
          maxLength={12}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.input}
        />
      </View>
      {error ? <Text style={[styles.hint, { color: colors.garnet }]}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  box: {
    height: 64,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 2,
  },
  focused: { borderColor: colors.ink, borderWidth: 1.5 },
  errored: { borderColor: colors.garnet },
  prefix: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  input: { flex: 1, height: '100%', fontFamily: fonts.display, fontSize: 28, color: colors.ink, outlineWidth: 0 },
  hint: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.textMuted },
});
