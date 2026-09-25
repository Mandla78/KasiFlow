import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/shared/components/Parts';
import { Cents, formatRand } from '@/shared/lib/money';
import { colors, fonts, radius } from '@/shared/theme/tokens';

/** "Paid and confirmed R5,000 of R38,000", with a bar. Only confirmed-by-both money counts. */
export function PaidProgress({ confirmedCents, totalCents, compact }: { confirmedCents: Cents; totalCents: Cents; compact?: boolean }) {
  const share = totalCents > 0 ? Math.min(confirmedCents / totalCents, 1) : 0;
  const bar = (
    <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(share * 100) }}>
      <View style={[styles.fill, { width: `${share * 100}%` }]} />
    </View>
  );
  if (compact) {
    return (
      <View style={{ gap: 6 }}>
        <Text style={styles.small}>
          <Text style={styles.smallStrong}>{formatRand(confirmedCents)}</Text> of {formatRand(totalCents)} paid and confirmed
        </Text>
        {bar}
      </View>
    );
  }
  return (
    <Card style={{ gap: 10 }}>
      <View style={styles.row}>
        <Text style={styles.label}>Paid and confirmed</Text>
        <Text style={styles.amount}>
          {formatRand(confirmedCents)} <Text style={styles.of}>of {formatRand(totalCents)}</Text>
        </Text>
      </View>
      {bar}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  label: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textMuted },
  amount: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  of: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.iconTile, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.pill, backgroundColor: colors.accent },
  small: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted },
  smallStrong: { fontFamily: fonts.bold, color: colors.ink },
});
