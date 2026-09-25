import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useSession } from '@/features/auth/session/SessionProvider';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Overline, Title } from '@/shared/components/Text';
import { formatPlace } from '@/shared/location-picker/components/AddressPickerField';
import { formatRand } from '@/shared/lib/money';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { clearCart, estimatedTotal, useCart } from '../../cart/lib/cartStore';
import { ordersApi } from '../../orders/api/ordersApi';
import { Fulfilment, OrderError, PaymentMethod } from '../../orders/types';
import { supplierApi } from '../../suppliers/api/supplierApi';
import type { Supplier } from '../../suppliers/types';
import { OptionCard } from '../components/OptionCard';

/** Delivery or collect, how to pay, the review, and "Place order". */
export default function CheckoutScreen() {
  const { supplierId } = useLocalSearchParams<{ supplierId: string }>();
  const { profile } = useSession();
  const { lines } = useCart(supplierId ?? '');
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [fulfilment, setFulfilment] = useState<Fulfilment | null>(null);
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supplierId) return;
    supplierApi.get(supplierId).then((s) => {
      setSupplier(s);
      // Sensible defaults from what the trader told us at sign-up.
      setFulfilment(s.delivers && profile.buying.fulfilment !== 'collect' ? 'delivery' : s.collect ? 'collect' : 'delivery');
      setPayment(s.payfast && profile.buying.payment !== 'cash' ? 'in_app' : s.cash ? 'cash' : 'in_app');
    });
  }, [supplierId, profile.buying.fulfilment, profile.buying.payment]);

  if (!supplier || !fulfilment || !payment) {
    return (
      <Screen back>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      </Screen>
    );
  }

  const subtotal = estimatedTotal(lines);
  const free = supplier.freeDeliveryOverCents !== null && subtotal >= supplier.freeDeliveryOverCents;
  const deliveryFee = fulfilment === 'delivery' && !free ? supplier.deliveryFeeCents : 0;
  const total = subtotal + deliveryFee;
  const overCashLimit = supplier.cashLimitCents !== null && total > supplier.cashLimitCents;
  const deliveryAddress = profile.location ? formatPlace(profile.location) : '';

  async function place() {
    if (!supplier || !fulfilment || !payment) return;
    setBusy(true);
    setError('');
    try {
      const order = await ordersApi.place({
        supplierId: supplier.id,
        lines: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
        fulfilment,
        payment,
        deliveryAddress: fulfilment === 'delivery' ? deliveryAddress : null,
      });
      clearCart(supplier.id);
      router.dismissAll();
      router.push(`/informal-business/orders/${order.id}`);
    } catch (e) {
      setError(e instanceof OrderError ? e.message : "Couldn't place the order. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <Screen back footer={<Button title={`Place order · ${formatRand(total)}`} onPress={place} loading={busy} disabled={payment === 'cash' && overCashLimit} />}>
      <View style={{ gap: 4 }}>
        <Title>Checkout</Title>
        <Text style={styles.muted}>{supplier.name}</Text>
      </View>

      <Overline>How you get it</Overline>
      <View style={{ gap: 8 }}>
        <OptionCard
          icon="truck"
          title={`Deliver to me${deliveryFee ? ` · ${formatRand(deliveryFee)}` : ' · free'}`}
          line={supplier.delivers ? deliveryAddress || 'Your business address' : "This supplier doesn't deliver"}
          selected={fulfilment === 'delivery'}
          disabled={!supplier.delivers}
          onPress={() => setFulfilment('delivery')}
        />
        <OptionCard
          icon="map-pin"
          title="I'll collect"
          line={supplier.collect ? `${supplier.address} · ${supplier.hours.map((h) => `${h.days} ${h.open}-${h.close}`).join(', ')}` : "This supplier doesn't do collection"}
          selected={fulfilment === 'collect'}
          disabled={!supplier.collect}
          onPress={() => setFulfilment('collect')}
        />
      </View>

      <Overline>How you pay</Overline>
      <View style={{ gap: 8 }}>
        <OptionCard
          icon="credit-card"
          title="Pay in the app"
          line={supplier.payfast ? 'Card or instant EFT on a secure payment page' : "This supplier doesn't take payment in the app"}
          selected={payment === 'in_app'}
          disabled={!supplier.payfast}
          onPress={() => setPayment('in_app')}
        />
        <OptionCard
          icon="dollar-sign"
          title={fulfilment === 'collect' ? 'Cash when you collect' : 'Cash on delivery'}
          line={
            !supplier.cash
              ? "This supplier doesn't take cash"
              : overCashLimit
                ? `Cash only up to ${formatRand(supplier.cashLimitCents ?? 0)} per order`
                : 'You and the supplier both confirm the amount'
          }
          selected={payment === 'cash'}
          disabled={!supplier.cash || overCashLimit}
          onPress={() => setPayment('cash')}
        />
      </View>

      <Overline>Your order</Overline>
      <Card style={{ gap: 10 }}>
        {lines.map((l) => (
          <View key={l.productId} style={styles.row}>
            <Text style={styles.item} numberOfLines={1}>
              {l.qty} × {l.name}
            </Text>
            <Text style={styles.amount}>{formatRand(l.seenPriceCents * l.qty)}</Text>
          </View>
        ))}
        <View style={styles.rule} />
        <View style={styles.row}>
          <Text style={styles.item}>Delivery</Text>
          <Text style={styles.amount}>{fulfilment === 'collect' ? '—' : deliveryFee ? formatRand(deliveryFee) : 'Free'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.total}>{formatRand(total)}</Text>
        </View>
      </Card>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.small}>The supplier&apos;s prices when you place the order are the ones that count; your order shows the final total.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  item: { flex: 1, fontFamily: fonts.medium, fontSize: 13.5, color: colors.text },
  amount: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  rule: { height: 1, backgroundColor: colors.line },
  totalLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  total: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.garnet, backgroundColor: colors.garnetTint, borderRadius: radius.sm, padding: 12 },
  small: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textMuted },
});
