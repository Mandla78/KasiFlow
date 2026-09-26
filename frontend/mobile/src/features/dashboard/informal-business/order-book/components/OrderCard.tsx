import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Tag } from '@/shared/components/Parts';
import { formatRand } from '@/shared/lib/money';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { label, linesText, NEXT_ACTION, PAYMENT_LABEL, STATUS_LABEL, waitingText } from '../lib/orders';
import type { Order } from '../types';

const TONE = { new: 'marigold', preparing: 'info', ready: 'jade', collected: 'muted', cancelled: 'garnet' } as const;

/**
 * An order in the queue: the big number the customer hears, what's in it,
 * how long they've waited, and ONE big button for the next step.
 */
export function OrderCard({ order, unsent, now, onNext, onCancel }: { order: Order; unsent: boolean; now: number; onNext?: () => void; onCancel?: () => void }) {
  const action = NEXT_ACTION[order.status];
  const ready = order.status === 'ready';
  return (
    <View style={[styles.card, ready && styles.ready]}>
      <View style={styles.head}>
        <Text style={styles.number} accessibilityLabel={`Order ${label(order)}`}>
          {label(order)}
        </Text>
        <View style={{ flex: 1, gap: 2 }}>
          {order.customerName ? <Text style={styles.name}>{order.customerName}</Text> : null}
          <Text style={styles.meta}>
            {formatRand(order.totalCents)} · {PAYMENT_LABEL[order.payment]} · {waitingText(order.createdAt, now)}
          </Text>
        </View>
        <Tag label={STATUS_LABEL[order.status]} tone={TONE[order.status]} />
      </View>
      <Text style={styles.lines}>{linesText(order.lines)}</Text>
      {unsent ? (
        <View style={styles.unsent}>
          <Feather name="cloud-off" size={13} color={colors.marigoldDeep} />
          <Text style={styles.unsentText}>On this phone, not sent yet</Text>
        </View>
      ) : null}
      {action && onNext ? (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${action}: order ${label(order)}`}
            onPress={onNext}
            style={({ pressed }) => [styles.next, ready && styles.nextReady, pressed && { opacity: 0.85 }]}>
            <Text style={styles.nextText}>{action}</Text>
          </Pressable>
          {onCancel && order.status !== 'ready' ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Cancel order ${label(order)}`} onPress={onCancel} hitSlop={6} style={styles.cancel}>
              <Feather name="x" size={20} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 8 },
  ready: { borderColor: colors.jade, borderWidth: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  number: { fontFamily: fonts.display, fontSize: 30, color: colors.ink, minWidth: 64 },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  meta: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  lines: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21, color: colors.text },
  unsent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  unsentText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.marigoldDeep },
  actions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  next: { flex: 1, height: 52, borderRadius: radius.md, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  nextReady: { backgroundColor: colors.jade },
  nextText: { fontFamily: fonts.bold, fontSize: 16.5, color: colors.white },
  cancel: { width: 52, height: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
});
