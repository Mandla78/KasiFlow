import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/shared/components/Screen';
import { Title } from '@/shared/components/Text';
import { formatRand } from '@/shared/lib/money';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { supplierApi } from '../../suppliers/api/supplierApi';
import type { Supplier } from '../../suppliers/types';
import { estimatedTotal, itemCount, useCart, useCartSupplierIds } from '../lib/cartStore';

/** Your carts: stock added but not ordered yet, one cart per supplier (one order = one supplier). */
export default function CartsScreen() {
  const ids = useCartSupplierIds();

  return (
    <Screen back>
      <Title>Your carts</Title>
      {ids.length === 0 ? (
        <View style={{ gap: 12, alignItems: 'center', paddingVertical: 30 }}>
          <Feather name="shopping-cart" size={28} color={colors.textMuted} />
          <Text style={styles.muted}>Nothing waiting to be ordered. Stock you add at a supplier shows here until you place the order.</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <Text style={styles.muted}>Each supplier is its own order.</Text>
          {ids.map((id) => (
            <SupplierCartRow key={id} supplierId={id} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function SupplierCartRow({ supplierId }: { supplierId: string }) {
  const { lines } = useCart(supplierId);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  useEffect(() => {
    supplierApi.get(supplierId).then(setSupplier).catch(() => setSupplier(null));
  }, [supplierId]);

  const count = itemCount(lines);
  return (
    <Pressable onPress={() => router.push(`/informal-business/cart/${supplierId}`)} style={styles.row} accessibilityRole="button">
      <View style={[styles.logo, { backgroundColor: supplier?.color ?? colors.ink }]}>
        <Text style={styles.logoText}>{supplier?.initials ?? '…'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{supplier?.name ?? 'Supplier'}</Text>
        <Text style={styles.muted}>
          {count} item{count === 1 ? '' : 's'} · {formatRand(estimatedTotal(lines))}
        </Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  muted: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textMuted, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 14 },
  logo: { width: 44, height: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontFamily: fonts.display, fontSize: 16, color: colors.white },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
});
