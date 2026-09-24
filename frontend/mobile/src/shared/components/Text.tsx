import { StyleSheet, Text, TextProps } from 'react-native';

import { colors, fonts } from '@/shared/theme/tokens';

/** Screen title: "Create your account". */
export function Title({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.title, style]} />;
}

/** Big money number: "R2,340". */
export function Money({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.money, style]} />;
}

export function Body({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.body, style]} />;
}

export function Strong({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.strong, style]} />;
}

export function Muted({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.muted, style]} />;
}

/** "STEP 1 OF 4", "TODAY", "YOUR SUPPLIERS". */
export function Overline({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.overline, style]} />;
}

export const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, letterSpacing: -0.5, color: colors.ink },
  money: { fontFamily: fonts.display, fontSize: 40, lineHeight: 46, letterSpacing: -1, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.textMuted },
  strong: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.text },
  muted: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, color: colors.textMuted },
  overline: {
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 0.8,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
});
