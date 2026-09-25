import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Overline, Title } from '@/shared/components/Text';
import { colors, fonts } from '@/shared/theme/tokens';

import { ordersApi } from '../api/ordersApi';
import { OrderRow } from '../components/OrderRow';
import { isActive } from '../lib/status';
import type { Order } from '../types';

/** My orders: active first, then the rest. */
export default function OrdersScreen() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [failed, setFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      ordersApi
        .list()
        .then(setOrders)
        .catch(() => setFailed(true));
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

const styles = StyleSheet.create({
  muted: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted },
});
