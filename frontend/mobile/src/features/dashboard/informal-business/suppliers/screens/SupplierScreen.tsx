import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryCode } from '@/constants/categories';
import { useSession } from '@/features/auth/session/SessionProvider';
import { Button } from '@/shared/components/Button';
import { BackButton, Screen } from '@/shared/components/Screen';
import { Sheet } from '@/shared/components/Sheet';
import { Overline } from '@/shared/components/Text';
import { formatRand } from '@/shared/lib/money';
import { colors, fonts, radius, sizes, space } from '@/shared/theme/tokens';

import { catalogueApi } from '../../catalogue/api/catalogueApi';
import { CategoryChips } from '../../catalogue/components/CategoryChips';
import { ProductGrid } from '../../catalogue/components/ProductGrid';
import { ProductSheet } from '../../catalogue/components/ProductSheet';
import type { Product } from '../../catalogue/types';
import { CartBar } from '../../cart/components/CartBar';
import { setLine, useCart } from '../../cart/lib/cartStore';
import { toCartLine } from '../../cart/lib/fromProduct';
import { cashLimitFor } from '../../orders/lib/cashPolicy';
import { supplierApi } from '../api/supplierApi';
import { ConnectButton } from '../components/ConnectButton';
import { SupplierAvatar } from '../components/SupplierAvatar';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { useConnect } from '../lib/useConnect';
import type { Supplier } from '../types';

type IconName = ComponentProps<typeof Feather>['name'];

/**
 * One supplier. Their name stays at the top and the search + categories
 * stay pinned while the products scroll. How they sell (delivery, address,
 * payment, minimum, hours) is one line here and in full behind ⓘ.
 * Ordering needs a connection: + asks to connect first.
 */
export default function SupplierScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useSession();
  const { isConnected, ask, sheet } = useConnect();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [category, setCategory] = useState<CategoryCode | 'all'>('all');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Product | null>(null);
  const [about, setAbout] = useState(false);
  const cart = useCart(id ?? '');

  const place = profile.location;
  const trader = useMemo(
    () => (place ? { place, categories: profile.categories, buying: profile.buying } : undefined),
    [place, profile.categories, profile.buying],
  );

  useEffect(() => {
    if (!id) return;
    supplierApi.get(id, trader).then(setSupplier).catch(() => setFailed(true));
  }, [id, trader]);

  // Products arrive a page (60) at a time: the first page shows at once and
  // the next one loads as the trader nears the bottom. Typing waits a moment
  // before searching, so each keystroke isn't a request. A newer search or
  // category always wins over an answer still on its way (the request id).
  const [query, setQuery] = useState({ category, search });
  useEffect(() => {
    const t = setTimeout(() => setQuery({ category, search }), search === query.search ? 0 : 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- query is what this sets
  }, [category, search]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const nextPage = useRef(1);
  const request = useRef(0);

  const loadPage = useCallback(
    (first: boolean) => {
      if (!id) return;
      const mine = ++request.current;
      const page = first ? 1 : nextPage.current;
      catalogueApi
        .page(id, { category: query.category === 'all' ? undefined : query.category, search: query.search }, page)
        .then((r) => {
          if (mine !== request.current) return;
          setProducts((prev) => (first || !prev ? r.products : [...prev, ...r.products]));
          setHasMore(r.hasMore);
          nextPage.current = page + 1;
        })
        .catch(() => mine === request.current && first && setFailed(true))
        .finally(() => mine === request.current && setLoadingMore(false));
    },
    [id, query],
  );

  // The current list stays on screen until the new one arrives.
  useEffect(() => loadPage(true), [loadPage]);

  const onScroll = (e: { nativeEvent: { layoutMeasurement: { height: number }; contentOffset: { y: number }; contentSize: { height: number } } }) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (hasMore && !loadingMore && layoutMeasurement.height + contentOffset.y >= contentSize.height - 600) {
      setLoadingMore(true);
      loadPage(false);
    }
  };

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

  const s = supplier;
  const connected = isConnected(s.id);
  /** Only connected traders can order: otherwise ask first, then do it. */
  const whenConnected = (action: () => void) => (connected ? action() : ask(s.id, s.name, action));
  const cashLimit = cashLimitFor(s);
  const hours = s.hours.map((h) => `${h.days} ${h.open}-${h.close}`).join(' · ');

  const summary = [
    s.delivers ? (s.deliveryFeeCents ? `Delivery ${formatRand(s.deliveryFeeCents)}` : 'Free delivery') : 'Collect only',
    `Min. order ${formatRand(s.minOrderCents)}`,
    s.payfast && s.cash ? 'Digital or cash' : s.payfast ? 'Digital payment' : 'Cash',
  ].join(' · ');

  const facts: { icon: IconName; text: string }[] = [
    s.delivers
      ? {
          icon: 'truck',
          text: `Delivers within ${s.deliveryRadiusKm} km · ${s.deliveryFeeCents ? formatRand(s.deliveryFeeCents) : 'free'}${s.freeDeliveryOverCents ? `, free over ${formatRand(s.freeDeliveryOverCents)}` : ''}`,
        }
      : { icon: 'truck', text: 'No delivery' },
    { icon: 'map-pin', text: s.collect ? `Collect at ${s.address}` : s.address },
    ...(s.payfast ? [{ icon: 'credit-card' as IconName, text: 'Digital payment: card or instant EFT' }] : []),
    ...(cashLimit ? [{ icon: 'dollar-sign' as IconName, text: `Accepts cash up to ${formatRand(cashLimit)} per order` }] : []),
    { icon: 'shopping-bag', text: `Minimum order ${formatRand(s.minOrderCents)}` },
    { icon: 'clock', text: hours },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Fixed: who you're buying from. */}
      <View style={styles.top}>
        <BackButton />
        <SupplierAvatar name={s.name} initials={s.initials} color={s.color} logoUrl={s.logoUrl} size={38} />
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {s.name}
            </Text>
            {s.verified ? <VerifiedBadge /> : null}
          </View>
          <Text style={styles.muted} numberOfLines={1}>
            {s.area}
          </Text>
        </View>
        <Pressable onPress={() => setAbout(true)} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="About this supplier">
          <Feather name="info" size={18} color={colors.ink} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          stickyHeaderIndices={[1]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={200}>
          <View style={styles.intro}>
            <Text style={styles.about}>{s.about}</Text>
            <Pressable onPress={() => setAbout(true)} style={styles.summary} accessibilityRole="button" accessibilityLabel="How they sell, more info">
              <Text style={styles.summaryText}>{summary}</Text>
              <Feather name="chevron-right" size={16} color={colors.textMuted} />
            </Pressable>
            {connected ? null : (
              <View style={styles.connect}>
                <Text style={styles.connectText}>Connect with {s.name} to start ordering.</Text>
                <ConnectButton name={s.name} connected={false} onPress={() => ask(s.id, s.name)} />
              </View>
            )}
          </View>

          {/* Pinned while the products scroll. */}
          <View style={styles.sticky}>
            <View style={styles.search}>
              <Feather name="search" size={16} color={colors.textMuted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={`Search ${s.name}`}
                placeholderTextColor={colors.textFaint}
                style={styles.searchInput}
              />
            </View>
            <CategoryChips categories={s.categories} value={category} onChange={setCategory} />
          </View>

          <View style={styles.products}>
            {!products ? (
              <ActivityIndicator color={colors.accent} />
            ) : products.length === 0 ? (
              <Text style={styles.muted}>Nothing here matches. Try another word or category.</Text>
            ) : (
              <ProductGrid
                products={products}
                quantityOf={qtyOf}
                onOpen={setOpen}
                onAdd={(p) => whenConnected(() => setQty(p, Math.max(qtyOf(p.id) + 1, p.minQty)))}
              />
            )}
            {loadingMore ? <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} /> : null}
          </View>
        </ScrollView>
        {cart.lines.length ? (
          <View style={styles.footer}>
            <CartBar supplierId={s.id} onOpen={() => router.push(`/informal-business/cart/${s.id}`)} />
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <ProductSheet
        key={open?.id ?? 'closed'}
        product={open}
        inCart={open ? qtyOf(open.id) : 0}
        onClose={() => setOpen(null)}
        onSetQuantity={(p, qty) => whenConnected(() => setQty(p, qty))}
      />

      <Sheet visible={about} onClose={() => setAbout(false)}>
        <ScrollView contentContainerStyle={{ gap: 12 }}>
          <View style={styles.nameRow}>
            <Text style={styles.sheetTitle}>{s.name}</Text>
            {s.verified ? <VerifiedBadge size={20} /> : null}
          </View>
          {s.verified ? <Text style={styles.muted}>Verified supplier</Text> : null}
          <Text style={styles.about}>{s.about}</Text>
          <View style={styles.facts}>
            {facts.map((f) => (
              <View key={f.text} style={styles.fact}>
                <Feather name={f.icon} size={15} color={colors.textMuted} />
                <Text style={styles.factText}>{f.text}</Text>
              </View>
            ))}
          </View>
          {s.reasons.length ? (
            <>
              <Overline>Why we suggest them</Overline>
              {s.reasons.map((r) => (
                <View key={r} style={styles.fact}>
                  <Feather name="check" size={15} color={colors.accentDeep} />
                  <Text style={styles.factText}>{r}</Text>
                </View>
              ))}
              {s.caution ? (
                <View style={styles.fact}>
                  <Feather name="alert-circle" size={15} color={colors.marigoldDeep} />
                  <Text style={[styles.factText, { color: colors.marigoldDeep }]}>{s.caution}</Text>
                </View>
              ) : null}
            </>
          ) : null}
          {connected ? (
            <Button
              title="Disconnect"
              variant="secondary"
              onPress={() => {
                setAbout(false);
                ask(s.id, s.name);
              }}
            />
          ) : null}
          <Button title="Close" variant="secondary" onPress={() => setAbout(false)} />
        </ScrollView>
      </Sheet>

      {sheet}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.porcelain },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: space.md,
    paddingBottom: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.porcelain,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  iconButton: {
    width: sizes.iconButton,
    height: sizes.iconButton,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muted: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, color: colors.textMuted },
  intro: { paddingHorizontal: 20, paddingTop: space.md, gap: 10 },
  about: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.text },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  connect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.accentTint,
    borderRadius: radius.md,
    padding: 12,
  },
  connectText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.ink },
  sticky: { backgroundColor: colors.porcelain, paddingHorizontal: 20, paddingTop: space.md, paddingBottom: space.sm, gap: 10 },
  search: { height: 46, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14 },
  searchInput: { flex: 1, height: '100%', fontFamily: fonts.medium, fontSize: 14.5, color: colors.text, outlineWidth: 0 },
  products: { paddingHorizontal: 20, paddingTop: space.sm, paddingBottom: space.xl },
  footer: { paddingHorizontal: 20, paddingTop: space.sm, paddingBottom: space.md },
  sheetTitle: { flexShrink: 1, fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  facts: { backgroundColor: colors.porcelain, borderRadius: radius.md, padding: 14, gap: 10 },
  fact: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  factText: { flex: 1, fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, color: colors.text },
});
