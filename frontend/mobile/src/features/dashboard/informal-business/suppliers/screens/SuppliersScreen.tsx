import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CategoryCode } from '@/constants/categories';
import { areaOf, isVerified } from '@/features/auth/profile';
import { useSession } from '@/features/auth/session/SessionProvider';
import { Screen } from '@/shared/components/Screen';
import { Overline } from '@/shared/components/Text';
import { TopBar } from '@/shared/components/TopBar';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { useCartItemCount } from '../../cart/lib/cartStore';
import { CategoryChips } from '../../catalogue/components/CategoryChips';
import { supplierMatchApi } from '../api/supplierMatchApi';
import { SupplierCircle } from '../components/SupplierCircle';
import { useConnect } from '../lib/useConnect';
import type { SupplierMatch } from '../types';

/**
 * Suppliers tab. Traders already have suppliers they trust, so nothing is
 * forced on them at sign-up. Sections, each supplier in one only:
 *   Your suppliers       -- connected; you can order from them
 *   Near you             -- deliver to you or close enough to collect, nearest first
 *   Recommended for you  -- sell what you buy, further away
 *   More suppliers       -- everyone else (the engine ranks, it never hides)
 */
export default function SuppliersScreen() {
  const { profile } = useSession();
  const { isConnected, syncFromServer } = useConnect();
  const [matches, setMatches] = useState<SupplierMatch[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [chip, setChip] = useState<CategoryCode | 'all'>('all');
  const [query, setQuery] = useState('');
  const cartItems = useCartItemCount();

  const place = profile.location;
  useEffect(() => {
    if (!place) return;
    let live = true;
    supplierMatchApi
      .matchSuppliers({ place, categories: profile.categories, buying: profile.buying })
      .then((m) => live && setMatches(m))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [place, profile.categories, profile.buying]);

  // The server knows the connections (in mock mode the profile does). Sync
  // ONCE per list the server sends -- never again when the phone's own list
  // changes, or a stale list would undo a Connect tapped since (that bug
  // made Connect look like it did nothing).
  const syncedFor = useRef<SupplierMatch[] | null>(null);
  useEffect(() => {
    if (!matches || syncedFor.current === matches) return;
    syncedFor.current = matches;
    if (matches.some((m) => m.connected !== undefined)) syncFromServer(matches.filter((m) => m.connected).map((m) => m.id));
  }, [matches, syncFromServer]);

  const q = query.trim().toLowerCase();
  const shown = (matches ?? []).filter(
    (m) => (chip === 'all' || m.sharedCategories.includes(chip)) && (!q || m.name.toLowerCase().includes(q) || m.area.toLowerCase().includes(q)),
  );
  const yours = shown.filter((m) => isConnected(m.id));
  const others = shown.filter((m) => !isConnected(m.id));
  const near = others.filter((m) => m.withinReach).sort((a, b) => a.distanceKm - b.distanceKm);
  const recommended = others.filter((m) => !m.withinReach && m.sharedCategories.length > 0);
  const more = others.filter((m) => !m.withinReach && m.sharedCategories.length === 0);
  const sections = [
    { title: 'Your suppliers', list: yours, hint: 'Suppliers you connect with show here. Open one and tap Connect to start ordering.' },
    { title: 'Near you', list: near, hint: '' },
    { title: 'Recommended for you', list: recommended, hint: '' },
    { title: 'More suppliers', list: more, hint: '' },
  ];

  return (
    <Screen tab>
      <TopBar
        verified={isVerified(profile)}
        imageUrl={profile.profileImageUrl}
        onAvatarPress={() => router.push('/informal-business/business')}
        initial={profile.businessName[0] ?? 'A'}
        title="Suppliers"
        subtitle={areaOf(profile) ? `Near ${areaOf(profile)}` : undefined}
        action={{ icon: 'shopping-cart', label: `Your carts, ${cartItems} items`, badge: cartItems, onPress: () => router.push('/informal-business/cart') }}
      />
      <View style={styles.search}>
        <Feather name="search" size={16} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search suppliers"
          placeholderTextColor={colors.textFaint}
          style={styles.searchInput}
        />
      </View>
      {/* The categories this trader buys (from sign-up / Business profile). */}
      <CategoryChips categories={profile.categories} value={chip} onChange={setChip} />

      {!matches && !failed ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.muted}>Finding suppliers near you…</Text>
        </View>
      ) : null}
      {failed ? <Text style={styles.muted}>Couldn&apos;t load suppliers. Check your connection and open this tab again.</Text> : null}

      {matches &&
        sections.map((sec) =>
          sec.list.length || (sec.hint && !q && chip === 'all') ? (
            <View key={sec.title} style={styles.section}>
              <View style={styles.sectionHead}>
                <Overline>{sec.title}</Overline>
                {sec.list.length ? <Text style={styles.count}>{sec.list.length}</Text> : null}
              </View>
              {sec.list.length ? (
                // A row you swipe sideways: big circles, the name below.
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row} contentContainerStyle={styles.rowContent}>
                  {sec.list.map((m) => (
                    <SupplierCircle key={m.id} match={m} connected={isConnected(m.id)} onOpen={() => router.push(`/informal-business/supplier/${m.id}`)} />
                  ))}
                </ScrollView>
              ) : (
                <Text style={styles.hint}>{sec.hint}</Text>
              )}
            </View>
          ) : null,
        )}

      {matches && shown.length === 0 ? (
        <Text style={styles.empty}>
          {matches.length === 0 ? 'No suppliers to show right now. New suppliers are joining; check again soon.' : 'No suppliers match. Try another word or category.'}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, height: '100%', fontFamily: fonts.medium, fontSize: 14.5, color: colors.text, outlineWidth: 0 },
  section: { gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textMuted },
  // Full width: the row runs edge to edge while the screen keeps its 20 px sides.
  row: { marginHorizontal: -20 },
  rowContent: { paddingHorizontal: 20, gap: 14 },
  hint: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  loading: { alignItems: 'center', gap: 10, paddingVertical: 30 },
  muted: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  empty: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted, textAlign: 'center', paddingVertical: 20 },
});
