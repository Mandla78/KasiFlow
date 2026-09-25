import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Card, IconTile } from '@/shared/components/Parts';
import { ConfirmSheet } from '@/shared/components/Sheet';
import { Overline } from '@/shared/components/Text';
import { colors, fonts } from '@/shared/theme/tokens';

import { practiceSignal } from '../api/orderBookApi';
import { OrderCard } from '../components/OrderCard';
import { open, step, useCounter } from '../lib/counterStore';
import { label, linesText, nextStatus } from '../lib/orders';
import type { Order } from '../types';

/**
 * Today's queue: New -> Preparing -> Ready -> Collected, one tap each.
 * Oldest first, so nobody is forgotten; ready ones stand out.
 */
export function QueueTab() {
  const { orders, unsent } = useCounter();
  const [now, setNow] = useState(() => Date.now());
  const [cancelling, setCancelling] = useState<Order | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [signal, setSignal] = useState(practiceSignal?.signal ?? true);

  // "Waiting 4 min" keeps up while the screen is open.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const active = orders.filter((o) => o.status === 'new' || o.status === 'preparing' || o.status === 'ready');
  const done = orders.filter((o) => o.status === 'collected').reverse();
  const ready = active.filter((o) => o.status === 'ready').length;

  return (
    <>
      <Text style={styles.count}>
        {active.length === 0 ? 'Nobody waiting.' : `${active.length} in the queue${ready ? ` · ${ready} ready` : ''}`}
      </Text>

      {active.length === 0 ? (
        <Card style={styles.center}>
          <IconTile name="coffee" size={44} />
          <Text style={styles.muted}>New orders show up here. Tap each one on as you go: Start, Ready, Collected.</Text>
        </Card>
      ) : (
        active.map((o) => (
          <OrderCard
            key={o.id}
            order={o}
            unsent={unsent.has(o.id)}
            now={now}
            onNext={() => {
              const n = nextStatus(o.status);
              if (n) void step(o, n);
            }}
            onCancel={() => setCancelling(o)}
          />
        ))
      )}

      {done.length ? (
        <View style={styles.section}>
          <Pressable accessibilityRole="button" onPress={() => setShowDone((v) => !v)} style={styles.doneHead}>
            <Overline>Collected today ({done.length})</Overline>
            <Feather name={showDone ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
          </Pressable>
          {showDone
            ? done.map((o) => (
                <View key={o.id} style={styles.doneRow}>
                  <Text style={styles.doneNumber}>{label(o)}</Text>
                  <Text style={styles.doneText} numberOfLines={1}>
                    {linesText(o.lines)}
                  </Text>
                </View>
              ))
            : null}
        </View>
      ) : null}

      {practiceSignal ? (
        <View style={styles.test}>
          <Feather name="smartphone" size={14} color={colors.accentDeep} />
          <Text style={styles.testText}>Test: signal</Text>
          <Switch
            accessibilityLabel="Test: signal"
            value={signal}
            onValueChange={(on) => {
              practiceSignal?.setSignal(on);
              setSignal(on);
              if (on) void open();
            }}
            trackColor={{ false: colors.line, true: colors.ink }}
            thumbColor={colors.white}
          />
        </View>
      ) : null}

      {cancelling ? (
        <ConfirmSheet
          visible
          title={`Cancel order ${label(cancelling)}?`}
          message="It leaves the queue and doesn't count in today's money."
          confirmLabel="Cancel the order"
          danger
          onCancel={() => setCancelling(null)}
          onConfirm={() => {
            const o = cancelling;
            setCancelling(null);
            void step(o, 'cancelled');
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  count: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  center: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  muted: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted, textAlign: 'center' },
  section: { gap: 8 },
  doneHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.line },
  doneNumber: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.textMuted, minWidth: 44 },
  doneText: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, color: colors.textMuted },
  test: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44 },
  testText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.accentDeep },
});
