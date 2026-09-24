import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, space } from '@/shared/theme/tokens';

type Props = {
  children: ReactNode;
  /** Pinned under the content: the main action. */
  footer?: ReactNode;
  back?: boolean;
  /** Tab screens: the tab bar already covers the bottom inset. */
  tab?: boolean;
};

/**
 * The page every screen sits on: porcelain background, safe areas, keyboard
 * that never hides the field you're typing in, and an action pinned at the
 * bottom where the thumb is.
 */
export function Screen({ children, footer, back, tab }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={tab ? ['top'] : ['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {back ? <BackButton /> : null}
          {children}
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function BackButton({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={8}
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
      style={styles.back}>
      <Feather name="chevron-left" size={26} color={colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.porcelain },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: space.md, paddingBottom: space.xl, gap: space.lg },
  footer: { paddingHorizontal: 20, paddingTop: space.sm, paddingBottom: space.md, gap: space.md },
  // 44 px: the minimum comfortable thumb target.
  back: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
