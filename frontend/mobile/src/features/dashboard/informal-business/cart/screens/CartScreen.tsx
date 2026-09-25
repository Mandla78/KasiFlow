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
        {supplier ? <Text style={styles.muted}>{supplier.name}</Text> : null}
      </View>

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
              <QuantityStepper value={l.qty} max={l.maxQty} onChange={(n) => setLine(supplierId ?? '', l, n)} />
            </View>
            <Text style={styles.lineTotal}>{formatRand(l.seenPriceCents * l.qty)}</Text>
          </View>
        ))}
      </Card>

      {supplier && short > 0 ? (
        <View style={styles.note}>
          <Feather name="info" size={14} color={colors.marigoldDeep} />
          <Text style={styles.noteText}>
            {supplier.name}&apos;s minimum order is {formatRand(supplier.minOrderCents)}.
          </Text>
        </View>
      ) : null}
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
  note: { flexDirection: 'row', gap: 8, backgroundColor: colors.marigoldTint, borderRadius: radius.sm, padding: 12 },
  noteText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  small: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textMuted },
});
