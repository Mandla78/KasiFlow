import { StyleSheet, Text, View } from 'react-native';

import { Card, Tag } from '@/shared/components/Parts';
import { Money } from '@/shared/components/Text';
import { Cents, formatRand } from '@/shared/lib/money';
import { colors, fonts } from '@/shared/theme/tokens';

/** "Total owed to you R340" with the counts that need attention. */
export function SummaryHeader({ label, totalCents, dueToday, overdue }: { label: string; totalCents: Cents; dueToday: number; overdue: number }) {
  return (
    <Card style={styles.card}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.label}>{label}</Text>
        <Money accessibilityLabel={`${label}: ${formatRand(totalCents)}`}>{formatRand(totalCents)}</Money>
      </View>
      <View style={styles.tags}>
        {dueToday > 0 ? <Tag label={`${dueToday} due today`} tone="marigold" /> : null}
        {overdue > 0 ? <Tag label={`${overdue} overdue`} tone="garnet" /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16 },
  label: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textMuted },
  tags: { gap: 6, alignItems: 'flex-end' },
});
