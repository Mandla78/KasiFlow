import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { Card, Tag } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Overline, Title } from '@/shared/components/Text';
import { formatRand } from '@/shared/lib/money';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { ordersApi } from '../api/ordersApi';
import { StatusTimeline } from '../components/StatusTimeline';
import { canCancel, isStopped, PAYMENT_LABEL, STATUS_LABEL, when } from '../lib/status';
import { Order, OrderError } from '../types';

const REFRESH_MS = 10_000;

/** One order: where it is, what's in it, how it's paid, its pass and documents. */
export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    ordersApi
      .get(id)
      .then(setOrder)
      .catch((e) => setError(e instanceof OrderError ? e.message : "Couldn't load this order."));
  }, [id]);
  useFocusEffect(load);
  // Keep the status fresh while the screen is open.
  useEffect(() => {
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  async function cancel() {
    if (!order) return;
    setBusy(true);
    try {
      setOrder(await ordersApi.cancel(order.id));
    } catch (e) {
      setError(e instanceof OrderError ? e.message : "Couldn't cancel. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!order) {
    return (
      <Screen back>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />}
      </Screen>
    );
  }

  const cash = order.payment === 'cash';
  const unpaid = order.status === 'awaiting_payment';
  const footer = unpaid ? (
    <Button title={`Pay ${formatRand(order.totalCents)}`} icon="lock" onPress={() => router.push(`/informal-business/pay/${order.id}`)} />
  ) : canCancel(order) ? (
    <Button title="Cancel order" variant="secondary" onPress={cancel} loading={busy} />
  ) : undefined;
  const needsPass = (cash || order.fulfilment === 'collect') && !['cancelled', 'rejected', 'delivered', 'collected'].includes(order.status);

  return (
    <Screen back footer={footer}>
      <View style={{ gap: 4 }}>
        <Title>{order.supplierName}</Title>
        <Text style={styles.muted}>
          {order.reference} · placed {when(order.placedAt)}
        </Text>
      </View>
      <View style={styles.tags}>
        <Tag label={STATUS_LABEL[order.status]} tone={isStopped(order) ? 'garnet' : 'info'} />
        <Tag label={PAYMENT_LABEL[order.paymentStatus]} tone={order.paymentStatus === 'paid' || order.paymentStatus === 'confirmed_by_both' ? 'jade' : 'marigold'} />
      </View>

      {unpaid ? (
        <View style={styles.notice}>
          <Feather name="credit-card" size={20} color={colors.marigoldDeep} />
          <Text style={styles.noticeText}>Pay to send this order to {order.supplierName}. They only see it once it&apos;s paid. Unpaid orders lapse after 24 hours.</Text>
        </View>
      ) : order.status === 'placed' ? (
        <View style={styles.notice}>
          <Feather name="clock" size={20} color={colors.marigoldDeep} />
          <Text style={styles.noticeText}>
            {order.supplierName} checks and accepts your order. We&apos;ll let you know here{cash ? ', and you pay cash when it arrives' : ''}.
          </Text>
        </View>
      ) : null}

      <Card>
        <StatusTimeline order={order} />
      </Card>

      {needsPass ? (
        <View style={styles.pass}>
          <Feather name="maximize" size={22} color={colors.ink} />
          <View style={{ flex: 1 }}>
            <Text style={styles.passTitle}>Order pass</Text>
            <Text style={styles.muted}>
              {cash ? 'Show this when the cash is handed over. You and the driver both confirm the amount.' : 'Show this when you collect.'} The
              QR code appears here once the supplier has accepted.
            </Text>
          </View>
        </View>
      ) : null}

      <Overline>{order.fulfilment === 'collect' ? 'Collect at' : 'Deliver to'}</Overline>
      <Text style={styles.address}>{order.address}</Text>

      <Overline>Items</Overline>
      <Card style={{ gap: 10 }}>
        {order.lines.map((l) => (
          <View key={l.productId} style={styles.row}>
            <Text style={styles.item} numberOfLines={2}>
              {l.qty} × {l.name} <Text style={styles.muted}>({l.packSize})</Text>
            </Text>
            <Text style={styles.amount}>{formatRand(l.lineTotalCents)}</Text>
          </View>
        ))}
        <View style={styles.rule} />
        <View style={styles.row}>
          <Text style={styles.item}>Delivery</Text>
          <Text style={styles.amount}>{order.fulfilment === 'collect' ? '—' : order.deliveryFeeCents ? formatRand(order.deliveryFeeCents) : 'Free'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.total}>{formatRand(order.totalCents)}</Text>
        </View>
      </Card>

      <Overline>Documents</Overline>
      <Card style={{ gap: 10 }}>
        <View style={styles.doc}>
          <Feather name="file-text" size={16} color={colors.textMuted} />
          <Text style={styles.docText}>Invoice (PDF)</Text>
          <Text style={styles.soon}>{order.paymentStatus === 'paid' || order.paymentStatus === 'confirmed_by_both' ? 'Coming soon' : 'After payment'}</Text>
        </View>
        <View style={styles.doc}>
          <Feather name="check-square" size={16} color={colors.textMuted} />
          <Text style={styles.docText}>Payment receipt (PDF)</Text>
          <Text style={styles.soon}>{order.paymentStatus === 'paid' || order.paymentStatus === 'confirmed_by_both' ? 'Coming soon' : 'After payment'}</Text>
        </View>
      </Card>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  tags: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  notice: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: colors.marigoldTint, borderRadius: radius.md, padding: 14 },
  noticeText: { flex: 1, fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, color: colors.text },
  pass: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: colors.accentTint, borderRadius: radius.md, padding: 14 },
  passTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink },
  address: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  item: { flex: 1, fontFamily: fonts.medium, fontSize: 13.5, color: colors.text },
  amount: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  rule: { height: 1, backgroundColor: colors.line },
  totalLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  total: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  doc: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  docText: { flex: 1, fontFamily: fonts.medium, fontSize: 13.5, color: colors.text },
  soon: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textMuted },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.garnet, backgroundColor: colors.garnetTint, borderRadius: radius.sm, padding: 12 },
});
