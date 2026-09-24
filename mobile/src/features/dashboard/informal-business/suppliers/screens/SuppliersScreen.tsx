import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card, Tag } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Overline } from '@/shared/components/Text';
import { TopBar } from '@/shared/components/TopBar';
import { Supplier, suppliers } from '../mock';
import { areaOf } from '@/features/auth/profile';
import { useSession } from '@/features/auth/session/SessionProvider';
import { colors, fonts, radius } from '@/shared/theme/tokens';

const CHIPS = ['All', 'Groceries', 'Drinks', 'Building'];

/** Your suppliers first, then others near you. Payment tags on every card. */
export default function Suppliers() {
  const { profile } = useSession();
  const [chip, setChip] = useState('All');
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const shown = suppliers.filter(
    (s) => (chip === 'All' || s.categories.includes(chip)) && (!q || s.name.toLowerCase().includes(q) || s.line.toLowerCase().includes(q)),
  );
  const yours = shown.filter((s) => s.yours);
  const near = shown.filter((s) => !s.yours);

  return (
    <Screen tab>
      <TopBar
        initial={profile.businessName[0] ?? 'K'}
        title="Suppliers"
        subtitle={`Delivering to ${areaOf(profile)}`}
        action={{ icon: 'shopping-cart', label: 'Cart', onPress: () => {} }}
      />
      <View style={styles.search}>
        <Feather name="search" size={16} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search suppliers or products"
          placeholderTextColor={colors.textFaint}
          style={styles.searchInput}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {CHIPS.map((c) => (
          <Pressable key={c} onPress={() => setChip(c)} style={[styles.chip, chip === c && styles.chipOn]}>
            <Text style={[styles.chipText, chip === c && { color: colors.white }]}>{c}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {yours.length ? <Overline>Your suppliers</Overline> : null}
      {yours.map((s) => (
        <SupplierCard key={s.id} s={s} />
      ))}
      {near.length ? <Overline>More near you</Overline> : null}
      {near.map((s) => (
        <SupplierCard key={s.id} s={s} />
      ))}
      {!shown.length ? <Text style={styles.empty}>No suppliers match. Try another word or category.</Text> : null}
    </Screen>
  );
}

function SupplierCard({ s }: { s: Supplier }) {
  return (
    <Card onPress={() => {}}>
      <View style={styles.row}>
        <View style={[styles.logo, { backgroundColor: s.color }]}>
          <Text style={styles.logoText}>{s.initials}</Text>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <View>
            <Text style={styles.name}>{s.name}</Text>
            <Text style={styles.line}>{s.line}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {s.payfast ? <Tag label="PayFast" /> : null}
            {s.cash ? <Tag label="Cash" tone="marigold" /> : null}
          </View>
        </View>
        <Feather name="chevron-right" size={17} color={colors.textFaint} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  search: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, height: '100%', fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  chip: {
    paddingHorizontal: 16,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 48, height: 48, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontFamily: fonts.display, fontSize: 16, color: colors.white },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  line: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 20 },
});
