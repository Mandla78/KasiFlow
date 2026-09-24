import { Feather } from '@expo/vector-icons';
import { ComponentProps, forwardRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { colors, fonts, radius, sizes } from '@/shared/theme/tokens';

type Props = TextInputProps & {
  label: string;
  icon?: ComponentProps<typeof Feather>['name'];
  hint?: string;
  error?: string;
  ok?: boolean;
  password?: boolean;
  optional?: boolean;
};

export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, icon, hint, error, ok, password, optional, style, ...input },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label}
        {optional ? <Text style={styles.optional}> (optional)</Text> : null}
      </Text>
      <View
        style={[
          styles.box,
          focused && styles.focused,
          !!error && styles.errored,
        ]}>
        {icon ? <Feather name={icon} size={16} color={colors.ink} /> : null}
        <TextInput
          ref={ref}
          {...input}
          secureTextEntry={password ? hidden : input.secureTextEntry}
          placeholderTextColor={colors.textFaint}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={[styles.input, style]}
        />
        {password ? (
          <Pressable
            hitSlop={10}
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            onPress={() => setHidden((h) => !h)}>
            <Feather name={hidden ? 'eye' : 'eye-off'} size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
        {ok && !password ? <Feather name="check" size={16} color={colors.jade} /> : null}
      </View>
      {error ? (
        <Text style={[styles.hint, { color: colors.garnet }]}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  optional: { fontFamily: fonts.medium, color: colors.textMuted },
  box: {
    height: sizes.input,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  focused: { borderColor: colors.ink, borderWidth: 1.5 },
  errored: { borderColor: colors.garnet },
  input: { flex: 1, height: '100%', fontFamily: fonts.medium, fontSize: 15, color: colors.text, outlineWidth: 0 },
  hint: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.textMuted },
});
