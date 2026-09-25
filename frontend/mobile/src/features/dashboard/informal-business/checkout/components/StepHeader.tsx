import { StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/shared/components/Screen';
import { colors, fonts } from '@/shared/theme/tokens';

/** "STEP 2 OF 3", a progress bar and the step's title; Back goes one step back. */
export function StepHeader({ step, total, title, onBack }: { step: number; total: number; title: string; onBack: () => void }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.row}>
        <BackButton onPress={onBack} />
        <Text style={styles.count}>
          STEP {step} OF {total}
        </Text>
      </View>
      <View style={styles.track}>
        {Array.from({ length: total }).map((_, i) => (
          <View key={i} style={[styles.segment, i < step && styles.on]} />
        ))}
      </View>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  count: { fontFamily: fonts.extrabold, fontSize: 12, letterSpacing: 1.2, color: colors.accentDeep },
  track: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.line },
  on: { backgroundColor: colors.accent },
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
});
