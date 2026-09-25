import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Title } from '@/shared/components/Text';
import { formatRand } from '@/shared/lib/money';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { ordersApi } from '../../orders/api/ordersApi';
import type { Order } from '../../orders/types';

/**
 * Digital payment for one order: card or instant EFT on the payment
 * provider's secure page. The app never sees card details. Until the
 * provider is switched on, this says so; the order stays saved and
 * waiting for payment.
 */
export default function PaymentScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (orderId) ordersApi.get(orderId).then(setOrder).catch(() => setFailed(true));
  }, [orderId]);

  if (!order) {
    return (
      <Screen back>
        {failed ? <Text style={styles.muted}>Couldn&apos;t load this order.</Text> : <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />}
      </Screen>
    );
  }

  return (
    <Screen back footer={<Button title="View my order" onPress={() => router.replace(`/informal-business/orders/${order.id}`)} />}>
      <View style={{ gap: 4 }}>
        <Title>Secure payment</Title>
        <Text style={styles.muted}>
          {order.reference} · {order.supplierName}
        </Text>
      </View>

      <Card style={styles.amountCard}>
        <Text style={styles.muted}>To pay</Text>
        <Text style={styles.amount}>{formatRand(order.totalCents)}</Text>
        <Text style={styles.muted}>Card or instant EFT</Text>
      </Card>

      <View style={styles.soon}>
        <Feather name="lock" size={22} color={colors.accentDeep} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.soonTitle}>Coming soon</Text>
          <Text style={styles.soonText}>
            Digital payment is being switched on. Your order is saved and waiting for payment; {order.supplierName} gets it as soon as it&apos;s paid.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  amountCard: { alignItems: 'center', gap: 4, paddingVertical: 22 },
  amount: { fontFamily: fonts.display, fontSize: 32, color: colors.ink },
  soon: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: colors.accentTint, borderRadius: radius.md, padding: 14 },
  soonTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink },
  soonText: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.text },
});
