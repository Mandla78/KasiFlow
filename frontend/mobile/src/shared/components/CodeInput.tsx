import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, fonts, radius } from '@/shared/theme/tokens';

export const CODE_LENGTH = 6;

export type CodeInputHandle = { focus: () => void };

type Props = {
  value: string;
  onChange: (code: string) => void;
  error?: boolean;
  label?: string;
};

/** Six boxes over one hidden input: the phone's keyboard can autofill the code from SMS/email. */
export const CodeInput = forwardRef<CodeInputHandle, Props>(function CodeInput({ value, onChange, error, label = 'Verification code' }, ref) {
  const input = useRef<TextInput>(null);
  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }));

  return (
    <>
      <Pressable onPress={() => input.current?.focus()} style={styles.boxes} accessibilityLabel={label}>
        {Array.from({ length: CODE_LENGTH }).map((_, i) => {
          const active = i === Math.min(value.length, CODE_LENGTH - 1);
          return (
            <View key={i} style={[styles.box, active && styles.boxActive, !!error && styles.boxError]}>
              <Text style={styles.digit}>{value[i] ?? ''}</Text>
            </View>
          );
        })}
      </Pressable>
      <TextInput
        ref={input}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, CODE_LENGTH))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={CODE_LENGTH}
        autoFocus
        style={styles.hidden}
      />
    </>
  );
});

const styles = StyleSheet.create({
  boxes: { flexDirection: 'row', gap: 8 },
  box: {
    flex: 1,
    height: 54,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: colors.ink, borderWidth: 1.5 },
  boxError: { borderColor: colors.garnet },
  digit: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  hidden: { position: 'absolute', opacity: 0, height: 1, width: 1 },
});
