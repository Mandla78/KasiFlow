import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';

import { CategoryCode } from '@/constants/categories';
import { areaOf, isVerified } from '@/features/auth/profile';
import { useSession } from '@/features/auth/session/SessionProvider';
import { Screen } from '@/shared/components/Screen';
import { Overline } from '@/shared/components/Text';
import { TopBar } from '@/shared/components/TopBar';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { useCartSupplierIds } from '../../cart/lib/cartStore';
import { CategoryChips } from '../../catalogue/components/CategoryChips';
import { supplierMatchApi } from '../api/supplierMatchApi';
import { SupplierCard } from '../components/SupplierCard';
import type { SupplierMatch } from '../types';

/**
 * Suppliers tab. Traders already have suppliers they trust, so nothing is
 * forced on them at sign-up. Here they see their own suppliers first, then
 * the engine's "Near you" list: suppliers who reach them and sell the
 * categories they buy, each with the reasons it was picked.
 */
export default function SuppliersScreen() {
  const { profile, updateProfile } = useSession();
  const [matches, setMatches] = useState<SupplierMatch[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [chip, setChip] = useState<CategoryCode | 'all'>('all');
  const [query, setQuery] = useState('');
  const hasCart = useCartSupplierIds().length > 0;

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

  const toggle = (id: string) =>
    updateProfile({
      supplierIds: profile.supplierIds.includes(id) ? profile.supplierIds.filter((x) => x !== id) : [...profile.supplierIds, id],
    });

  const q = query.trim().toLowerCase();
  const shown = (matches ?? []).filter(
    (m) => (chip === 'all' || m.sharedCategories.includes(chip)) && (!q || m.name.toLowerCase().includes(q) || m.area.toLowerCase().includes(q)),
  );
  const yours = shown.filter((m) => profile.supplierIds.includes(m.id));
  const near = shown.filter((m) => !profile.supplierIds.includes(m.id));

  return (
    <Screen tab>
      <TopBar
        verified={isVerified(profile)}
        imageUrl={profile.profileImageUrl}
        onAvatarPress={() => router.push('/informal-business/business')}
        initial={profile.businessName[0] ?? 'A'}
        title="Suppliers"
        subtitle={areaOf(profile) ? `Near ${areaOf(profile)}` : undefined}
        action={{ icon: 'shopping-cart', label: 'Your carts', dot: hasCart, onPress: () => router.push('/informal-business/cart') }}
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

      {yours.length ? <Overline>Your suppliers</Overline> : null}
      {yours.map((m) => (
        <SupplierCard key={m.id} match={m} added onToggle={() => toggle(m.id)} onOpen={() => router.push(`/informal-business/supplier/${m.id}`)} />
      ))}

      {near.length ? <Overline>Near you</Overline> : null}
      {near.map((m, i) => (
        <SupplierCard
          key={m.id}
          match={m}
          added={false}
          best={i === 0 && !q && chip === 'all'}
          onToggle={() => toggle(m.id)}
          onOpen={() => router.push(`/informal-business/supplier/${m.id}`)}
        />
      ))}

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
  loading: { alignItems: 'center', gap: 10, paddingVertical: 30 },
  muted: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  empty: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted, textAlign: 'center', paddingVertical: 20 },
});
