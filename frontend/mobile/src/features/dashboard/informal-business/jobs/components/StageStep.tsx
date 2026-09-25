import { Feather } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Tag } from '@/shared/components/Parts';
import { formatRand } from '@/shared/lib/money';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { statusLabel } from '../lib/stages';
import { Stage } from '../types';

/** One stage as a step (PDF p12): tick, name, status, amount, photo. Tap to work on it. */
export function StageStep({ stage, selected, onPress, last }: { stage: Stage; selected: boolean; onPress: () => void; last?: boolean }) {
  const label = statusLabel(stage);
  const done = stage.status === 'confirmed';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${stage.name}, ${formatRand(stage.amountCents)}, ${label.text}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && styles.rule, selected && styles.selected, pressed && { opacity: 0.8 }]}>
      <View style={[styles.dot, done && styles.dotDone, selected && !done && styles.dotCurrent]}>
        {done ? <Feather name="check" size={14} color={colors.white} /> : null}
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={[styles.name, stage.status === 'not_started' && styles.faded]}>{stage.name}</Text>
        <Tag label={label.text} tone={label.tone} />
        {stage.status === 'amounts_dont_match' ? (
          <Text style={styles.dispute}>
            You: {formatRand(stage.builderAmountCents ?? 0)} · Client: {formatRand(stage.clientAmountCents ?? 0)}
          </Text>
        ) : null}
        {stage.clientNote && stage.status === 'photo_taken' ? <Text style={styles.note}>&ldquo;{stage.clientNote}&rdquo;</Text> : null}
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, stage.status === 'not_started' && styles.faded]}>{formatRand(stage.amountCents)}</Text>
        {stage.photo ? <Image source={{ uri: stage.photo.uri }} style={styles.thumb} accessibilityLabel={`${stage.name} photo`} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14, paddingHorizontal: 4 },
  rule: { borderBottomWidth: 1, borderBottomColor: colors.line },
  selected: { backgroundColor: colors.accentTint, borderRadius: radius.sm, paddingHorizontal: 8, marginHorizontal: -4 },
  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.iconTile, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  dotDone: { backgroundColor: colors.jade, borderColor: colors.jade },
  dotCurrent: { borderColor: colors.accent, backgroundColor: colors.white },
  name: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.text },
  faded: { color: colors.textMuted },
  dispute: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.garnet },
  note: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, fontStyle: 'italic' },
  right: { alignItems: 'flex-end', gap: 6 },
  amount: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.ink },
  thumb: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.iconTile },
});
