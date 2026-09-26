import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Overline, Title } from '@/shared/components/Text';
import { formatRand } from '@/shared/lib/money';
import { colors, fonts } from '@/shared/theme/tokens';

import { ordersApi } from '../api/ordersApi';
import { OrderRow } from '../components/OrderRow';
import { isActive } from '../lib/status';
import type { MoneySummary, Order } from '../types';

/** My orders: active first, then the rest. */
export default function OrdersScreen() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [money, setMoney] = useState<MoneySummary | null>(null);

  useFocusEffect(
    useCallback(() => {
      ordersApi
        .list()
        .then(setOrders)
        .catch(() => setFailed(true));
      ordersApi
        .summary()
        .then(setMoney)
        .catch(() => setMoney(null));
    }, []),
  );

  const active = (orders ?? []).filter(isActive);
  const past = (orders ?? []).filter((o) => !isActive(o));
  const open = (o: Order) => router.push(`/informal-business/orders/${o.id}`);

  return (
    <Screen back>
      <Title>My orders</Title>
      {failed ? <Text style={styles.muted}>Couldn&apos;t load your orders. Check your connection and try again.</Text> : null}
      {!orders && !failed ? <ActivityIndicator color={colors.accent} /> : null}
      {orders && orders.length === 0 ? (
        <View style={{ gap: 12, paddingTop: 20 }}>
          <Text style={styles.muted}>No orders yet. Find a supplier and order your stock.</Text>
          <Button title="Find suppliers" variant="secondary" onPress={() => router.push('/informal-business/suppliers')} />
        </View>
      ) : null}
      {money && orders && orders.length ? (
        // Kept apart on purpose: only digital payments are verified by a
        // payment provider. Cash is what both sides said. Never one total.
        <Card style={{ gap: 10 }}>
          <MoneyRow label="Paid digitally" note="Verified by PayFast" cents={money.providerVerifiedCents} count={money.providerVerifiedOrders} tone={colors.jade} />
          <MoneyRow label="Cash, confirmed by both" note="You and the supplier both confirmed it" cents={money.confirmedByBothCents} count={money.confirmedByBothOrders} tone={colors.accentDeep} />
          <MoneyRow label="Cash, not confirmed yet" note="Not proof of payment until you both confirm" cents={money.notConfirmedCents} count={money.notConfirmedOrders} tone={colors.marigoldDeep} />
        </Card>
      ) : null}
      {active.length ? (
        <>
          <Overline>Active</Overline>
          <Card style={{ paddingVertical: 2 }}>
            {active.map((o, i) => (
              <OrderRow key={o.id} order={o} onPress={() => open(o)} last={i === active.length - 1} />
            ))}
          </Card>
        </>
      ) : null}
      {past.length ? (
        <>
          <Overline>Past</Overline>
          <Card style={{ paddingVertical: 2 }}>
            {past.map((o, i) => (
              <OrderRow key={o.id} order={o} onPress={() => open(o)} last={i === past.length - 1} />
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function MoneyRow({ label, note, cents, count, tone }: { label: string; note: string; cents: number; count: number; tone: string }) {
  return (
    <View style={styles.moneyRow}>
      <View style={[styles.dot, { backgroundColor: tone }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.moneyLabel}>{label}</Text>
        <Text style={styles.small}>
          {note} · {count} {count === 1 ? 'order' : 'orders'}
        </Text>
      </View>
      <Text style={styles.moneyValue}>{formatRand(cents)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  muted: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted },
  moneyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  moneyLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  moneyValue: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
});
