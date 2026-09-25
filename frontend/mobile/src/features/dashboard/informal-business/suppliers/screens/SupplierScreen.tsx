import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { ComponentProps, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';

import { CategoryCode } from '@/constants/categories';
import { Screen } from '@/shared/components/Screen';
import { Overline } from '@/shared/components/Text';
import { formatRand } from '@/shared/lib/money';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { catalogueApi } from '../../catalogue/api/catalogueApi';
import { CategoryChips } from '../../catalogue/components/CategoryChips';
import { ProductGrid } from '../../catalogue/components/ProductGrid';
import { ProductSheet } from '../../catalogue/components/ProductSheet';
import type { Product } from '../../catalogue/types';
import { CartBar } from '../../cart/components/CartBar';
import { setLine, useCart } from '../../cart/lib/cartStore';
import { toCartLine } from '../../cart/lib/fromProduct';
import { supplierApi } from '../api/supplierApi';
import type { Supplier } from '../types';

type IconName = ComponentProps<typeof Feather>['name'];

/** One supplier: who they are, how they sell, and their products in a grid. */
export default function SupplierScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [category, setCategory] = useState<CategoryCode | 'all'>('all');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Product | null>(null);
  const cart = useCart(id ?? '');

  useEffect(() => {
    if (!id) return;
    supplierApi.get(id).then(setSupplier).catch(() => setFailed(true));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let live = true;
    // The current list stays on screen until the new one arrives.
    catalogueApi
      .products(id, { category: category === 'all' ? undefined : category, search })
      .then((p) => live && setProducts(p))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [id, category, search]);

  const qtyOf = (productId: string) => cart.lines.find((l) => l.productId === productId)?.qty ?? 0;
  const setQty = (p: Product, qty: number) => setLine(p.supplierId, toCartLine(p), qty);

  if (failed) {
    return (
      <Screen back>
        <Text style={styles.muted}>Couldn&apos;t load this supplier. Check your connection and try again.</Text>
      </Screen>
    );
  }
  if (!supplier) {
    return (
      <Screen back>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      </Screen>
    );
  }

  const facts: { icon: IconName; text: string }[] = [
    supplier.delivers
      ? {
          icon: 'truck',
          text: `Delivers within ${supplier.deliveryRadiusKm} km · ${supplier.deliveryFeeCents ? formatRand(supplier.deliveryFeeCents) : 'free'}${supplier.freeDeliveryOverCents ? `, free over ${formatRand(supplier.freeDeliveryOverCents)}` : ''}`,
        }
      : { icon: 'truck', text: 'No delivery' },
    { icon: 'map-pin', text: supplier.collect ? `Collect at ${supplier.address}` : supplier.address },
    { icon: 'credit-card', text: [supplier.payfast && 'Pay in the app', supplier.cash && 'Cash on delivery'].filter(Boolean).join(' · ') },
    { icon: 'shopping-bag', text: `Minimum order ${formatRand(supplier.minOrderCents)}` },
    { icon: 'clock', text: supplier.hours.map((h) => `${h.days} ${h.open}-${h.close}`).join(' · ') },
  ];

  return (
    <Screen back footer={cart.lines.length ? <CartBar supplierId={supplier.id} onOpen={() => router.push(`/informal-business/cart/${supplier.id}`)} /> : undefined}>
      <View style={styles.head}>
        <View style={[styles.logo, { backgroundColor: supplier.color }]}>
          <Text style={styles.logoText}>{supplier.initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{supplier.name}</Text>
          <Text style={styles.muted}>{supplier.area}</Text>
        </View>
      </View>
      <Text style={styles.about}>{supplier.about}</Text>
      <View style={styles.facts}>
        {facts.map((f) => (
          <View key={f.text} style={styles.fact}>
            <Feather name={f.icon} size={14} color={colors.textMuted} />
            <Text style={styles.factText}>{f.text}</Text>
          </View>
        ))}
      </View>

      <Overline>Products</Overline>
      <View style={styles.search}>
        <Feather name="search" size={16} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search this supplier"
          placeholderTextColor={colors.textFaint}
          style={styles.searchInput}
        />
      </View>
      <CategoryChips categories={supplier.categories} value={category} onChange={setCategory} />

      {!products ? (
        <ActivityIndicator color={colors.accent} />
      ) : products.length === 0 ? (
        <Text style={styles.muted}>Nothing here matches. Try another word or category.</Text>
      ) : (
        <ProductGrid products={products} quantityOf={qtyOf} onOpen={setOpen} onAdd={(p) => setQty(p, qtyOf(p.id) + 1)} />
      )}

      <ProductSheet key={open?.id ?? 'closed'} product={open} inCart={open ? qtyOf(open.id) : 0} onClose={() => setOpen(null)} onSetQuantity={setQty} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logo: { width: 56, height: 56, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontFamily: fonts.display, fontSize: 20, color: colors.white },
  name: { fontFamily: fonts.display, fontSize: 21, color: colors.ink },
  muted: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  about: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.text },
  facts: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 9 },
  fact: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  factText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.text },
  search: { height: 46, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14 },
  searchInput: { flex: 1, height: '100%', fontFamily: fonts.medium, fontSize: 14.5, color: colors.text, outlineWidth: 0 },
});
