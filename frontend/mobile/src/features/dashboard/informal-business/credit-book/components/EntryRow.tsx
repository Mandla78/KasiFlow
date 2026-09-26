import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Tag } from '@/shared/components/Parts';
import { formatRand } from '@/shared/lib/money';
import { colors, fonts } from '@/shared/theme/tokens';

import { dueLabel } from '../lib/dueDates';
import { CreditEntry } from '../types';

/** One line of the book: who, what they took, what's left, and when it's due. */
export function EntryRow({ entry, today, onPress, last }: { entry: CreditEntry; today: string; onPress: () => void; last?: boolean }) {
  const name = entry.customer.name;
  const paid = entry.status === 'paid';
  const cancelled = entry.status === 'cancelled';
  const finished = paid || cancelled;
  const due = dueLabel(entry.dueOn, today);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${formatRand(finished ? entry.amountCents : entry.outstandingCents)}, ${paid ? 'paid back' : cancelled ? 'cancelled' : due.text}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && styles.rule, pressed && { opacity: 0.7 }]}>
      <View style={[styles.avatar, finished && { opacity: 0.6 }]}>
        <Text style={styles.initial}>{name.trim()[0]?.toUpperCase() ?? '?'}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.name, finished && styles.faded]} numberOfLines={1}>
          {name}
        </Text>
        {entry.description ? (
          <Text style={styles.sub} numberOfLines={1}>
            {entry.description}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, finished && styles.faded]}>{formatRand(finished ? entry.amountCents : entry.outstandingCents)}</Text>
        {paid ? (
          <Tag label="Paid back" tone="jade" />
        ) : cancelled ? (
          <Tag label="Cancelled" tone="muted" />
        ) : (
          <Tag label={due.text} tone={due.tone === 'late' || due.tone === 'today' ? 'marigold' : 'muted'} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, minHeight: 64 },
  rule: { borderBottomWidth: 1, borderBottomColor: colors.line },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.iconTile, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  name: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  right: { alignItems: 'flex-end', gap: 5 },
  amount: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.ink },
  faded: { color: colors.textMuted },
});
