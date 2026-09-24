/**
 * The frame every onboarding step shares, so five screens read as one flow:
 *
 *   ‹  STEP 2 OF 5                       <- back moves between steps
 *   ▬▬▬▬▬▬ ▬▬▬▬▬▬ ▬▬▬▬▬▬ ▬▬▬▬▬▬ ▬▬▬▬▬▬   <- emerald segments, done + current
 *   Title                         ⓘ     <- why we ask, one tap away
 *   [fields, all the same shape]
 *   ─────────────────────────────────
 *   [ Continue ]                        <- pinned where the thumb is
 *   [ Skip ]                            <- only on optional steps
 *
 * Step one has no back: behind it is account creation, and a flow you can
 * reverse out of drops you somewhere you've already finished.
 *
 * EDITING (More -> Business profile): the same screens, one at a time. No
 * step count, a plain back, "Save changes", and no skip.
 */
import { router } from 'expo-router';
import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/shared/components/Button';
import { BackButton } from '@/shared/components/Screen';
import { InfoHint } from '@/shared/components/InfoHint';
import { colors, fonts } from '@/shared/theme/tokens';

import { STEPS, StepId } from '../steps';

type Props = {
  step: StepId;
  title: string;
  /** Why we ask, behind the ⓘ. Required: a question with no reason shouldn't be asked. */
  why: string | string[];
  children: ReactNode;
  primaryLabel?: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  busy?: boolean;
  error?: string;
  /** "Skip for now", on the optional step only. */
  onSkip?: () => void;
  /** Opened from Business profile to change one answer, not as part of sign-up. */
  editing?: boolean;
};

export function StepScaffold({ step, title, why, children, primaryLabel = 'Continue', onPrimary, primaryDisabled, busy, error, onSkip, editing }: Props) {
  const index = STEPS.findIndex((s) => s.id === step);
  if (editing) {
    primaryLabel = 'Save changes';
    onSkip = undefined;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {editing ? (
          <View style={styles.header}>
            <BackButton onPress={() => router.back()} />
          </View>
        ) : (
        <View style={styles.header}>
          <View style={styles.headRow}>
            {index > 0 ? (
              <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace(STEPS[index - 1].route))} />
            ) : (
              <View style={styles.back} />
            )}
            <Text style={styles.count}>
              STEP {index + 1} OF {STEPS.length}
            </Text>
          </View>
          <View style={styles.track}>
            {STEPS.map((s, i) => (
              <View key={s.id} style={[styles.segment, i <= index && styles.segmentOn]} />
            ))}
          </View>
        </View>
        )}

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{title}</Text>
            <InfoHint title={title} body={why} size={20} />
          </View>
          <View style={styles.body}>{children}</View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button title={primaryLabel} onPress={onPrimary} disabled={primaryDisabled} loading={busy} />
          {onSkip ? (
            <Pressable onPress={onSkip} style={styles.skip} accessibilityRole="button">
              <Text style={styles.skipText}>Skip for now</Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.porcelain },
  header: { paddingHorizontal: 20, paddingTop: 10, gap: 10 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // A fixed slot whether the arrow shows or not, so the count never jumps.
  back: { width: 44, height: 44 },
  count: { fontFamily: fonts.extrabold, fontSize: 12, letterSpacing: 1.2, color: colors.accentDeep },
  track: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.line },
  segmentOn: { backgroundColor: colors.accent },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 28, gap: 22 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flexShrink: 1, fontFamily: fonts.display, fontSize: 26, lineHeight: 32, letterSpacing: -0.5, color: colors.ink },
  body: { gap: 18 },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.garnet },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.porcelain,
  },
  skip: { alignItems: 'center', paddingVertical: 12 },
  skipText: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.textMuted },
});
