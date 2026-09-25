import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Tag } from '@/shared/components/Parts';
import { formatRand } from '@/shared/lib/money';
import { colors, fonts } from '@/shared/theme/tokens';

import { isActive, STATUS_LABEL, when } from '../lib/status';
import type { Order } from '../types';

/** One order in "My orders": supplier, reference, when, total, status. */
export function OrderRow({ order, onPress, last }: { order: Order; onPress: () => void; last?: boolean }) {
  const tone = order.status === 'cancelled' || order.status === 'rejected' ? 'garnet' : isActive(order) ? 'marigold' : 'jade';
  return (
    <Pressable onPress={onPress} style={[styles.row, !last && styles.rule]} accessibilityRole="button">
      <View style={styles.icon}>
        <Feather name={order.fulfilment === 'collect' ? 'map-pin' : 'truck'} size={16} color={colors.ink} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.name}>{order.supplierName}</Text>
        <Text style={styles.muted}>
          {order.reference} · {when(order.placedAt)}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text style={styles.total}>{formatRand(order.totalCents)}</Text>
        <Tag label={STATUS_LABEL[order.status]} tone={tone} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rule: { borderBottomWidth: 1, borderBottomColor: colors.line },
  icon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.iconTile, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  muted: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted },
  total: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink },
});
