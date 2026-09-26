import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Title } from '@/shared/components/Text';
import { formatRand } from '@/shared/lib/money';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { ProductImage } from '../../catalogue/components/ProductImage';
import { supplierApi } from '../../suppliers/api/supplierApi';
import type { Supplier } from '../../suppliers/types';
import { QuantityStepper } from '../components/QuantityStepper';
import { estimatedTotal, itemCount, setLine, useCart } from '../lib/cartStore';

/** One supplier's cart: lines, quantities, the minimum order, the estimated total. */
export default function CartScreen() {
  const { supplierId } = useLocalSearchParams<{ supplierId: string }>();
  const { lines } = useCart(supplierId ?? '');
  const [supplier, setSupplier] = useState<Supplier | null>(null);

  useEffect(() => {
    if (supplierId) supplierApi.get(supplierId).then(setSupplier).catch(() => setSupplier(null));
  }, [supplierId]);

  const total = estimatedTotal(lines);
  const count = itemCount(lines);
  const short = supplier ? Math.max(0, supplier.minOrderCents - total) : 0;
  const toFreeDelivery =
    supplier?.delivers && supplier.freeDeliveryOverCents !== null ? Math.max(0, supplier.freeDeliveryOverCents - total) : null;

  if (!lines.length) {
    return (
      <Screen back>
        <Title>Your cart</Title>
        <View style={styles.empty}>
          <Feather name="shopping-cart" size={28} color={colors.textMuted} />
          <Text style={styles.muted}>Your cart is empty.</Text>
        </View>
        <Button title="Back to the products" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen
      back
      footer={
        <>
          {/* Fixed, so the total is always in view however long the cart is. */}
          <View style={styles.totals}>
            <Text style={styles.totalLabel}>
              Estimated total · {count} {count === 1 ? 'item' : 'items'}
            </Text>
            <Text style={styles.total}>{formatRand(total)}</Text>
          </View>
          <Button
            title={short > 0 ? `Add ${formatRand(short)} more to order` : 'Continue to checkout'}
            disabled={short > 0 || !supplier}
            onPress={() => router.push(`/informal-business/checkout/${supplierId}`)}
          />
        </>
      }>
      <View style={{ gap: 4 }}>
        <Title>Your cart</Title>
        {supplier ? (
          <Text style={styles.muted}>
            {supplier.name} · {lines.length} {lines.length === 1 ? 'product' : 'products'}, {count} {count === 1 ? 'item' : 'items'}
          </Text>
        ) : null}
      </View>

      {supplier ? (
        <Card style={{ gap: 10 }}>
          {/* How close the cart is to the minimum order, and to free delivery. */}
          <View style={{ gap: 6 }}>
            <View style={styles.row}>
              <Text style={styles.hintTitle}>{short > 0 ? `Add ${formatRand(short)} more to order` : 'Minimum order reached'}</Text>
              <Text style={styles.muted}>min. {formatRand(supplier.minOrderCents)}</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, short === 0 && styles.fillDone, { width: `${Math.min(100, Math.round((total / Math.max(supplier.minOrderCents, 1)) * 100))}%` }]} />
            </View>
          </View>
          {toFreeDelivery !== null ? (
            <View style={styles.hint}>
              <Feather name="truck" size={14} color={toFreeDelivery === 0 ? colors.jade : colors.textMuted} />
              <Text style={styles.hintText}>
                {toFreeDelivery === 0 ? 'Free delivery on this order' : `${formatRand(toFreeDelivery)} more for free delivery`}
              </Text>
            </View>
          ) : null}
        </Card>
      ) : null}

      <Card style={{ gap: 14 }}>
        {lines.map((l) => (
          <View key={l.productId} style={styles.line}>
            <ProductImage url={l.image} category={l.category} size={52} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.name} numberOfLines={2}>
                {l.name}
              </Text>
              <Text style={styles.muted}>
                {l.packSize} · {formatRand(l.seenPriceCents)}
              </Text>
              {l.unitsPerPack && l.unitsPerPack > 1 ? (
                // For traders who sell singles: what each one costs them.
                <Text style={styles.each}>{formatRand(Math.round(l.seenPriceCents / l.unitsPerPack))} each</Text>
              ) : null}
              <QuantityStepper value={l.qty} max={l.maxQty} onChange={(n) => setLine(supplierId ?? '', l, n)} />
            </View>
            <Text style={styles.lineTotal}>{formatRand(l.seenPriceCents * l.qty)}</Text>
          </View>
        ))}
      </Card>

      <Text style={styles.small}>The supplier&apos;s price when you place the order is the one you pay. Delivery is added at checkout.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  line: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  name: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  lineTotal: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  totals: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  totalLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  total: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  hintTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.line, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.pill, backgroundColor: colors.marigold },
  fillDone: { backgroundColor: colors.jade },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hintText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  each: { fontFamily: fonts.semibold, fontSize: 12, color: colors.accentDeep },
  small: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textMuted },
});
