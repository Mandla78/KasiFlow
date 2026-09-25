import { Feather } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View } from 'react-native';

import { Tag } from '@/shared/components/Parts';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { Stage } from '../types';

function when(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'today';
  return `${d.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]}`;
}

/** One stage in a house record (PDF p15): photo, stage, and who stands behind it. */
export function RecordStageRow({ stage, last }: { stage: Stage; last?: boolean }) {
  const both = stage.status === 'confirmed';
  const sub = both
    ? stage.photo
      ? `Photo + sign-off · ${when(stage.confirmedAt)}`
      : `Paid · both confirmed · ${when(stage.confirmedAt)}`
    : stage.status === 'amounts_dont_match'
      ? "Amounts don't match yet"
      : `Photo taken ${when(stage.photo?.takenAt ?? null)} · waiting for the client`;
  return (
    <View style={[styles.row, !last && styles.rule]}>
      {stage.photo ? (
        <Image source={{ uri: stage.photo.uri }} style={styles.thumb} accessibilityLabel={`${stage.name} photo`} />
      ) : (
        <View style={[styles.thumb, styles.noPhoto]}>
          <Feather name="dollar-sign" size={18} color={colors.textMuted} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.name}>{stage.name}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
      <Tag label={both ? 'Both ✓✓' : 'By you ✓'} tone={both ? 'jade' : 'muted'} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rule: { borderBottomWidth: 1, borderBottomColor: colors.line },
  thumb: { width: 52, height: 52, borderRadius: radius.sm, backgroundColor: colors.iconTile },
  noPhoto: { alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted },
});
