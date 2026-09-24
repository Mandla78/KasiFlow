import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useSession } from '@/features/auth/session/SessionProvider';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { onboardingApi } from '../api/onboardingApi';
import { StepScaffold } from '../components/StepScaffold';
import type { SupplierMatch } from '../types';

/**
 * Step 5, the payoff: the supplier engine's matches for everything the
 * trader told us, each with the reasons it was picked.
 */
export default function SuppliersForYouScreen() {
  const { profile, updateProfile, finishOnboarding } = useSession();
  const [matches, setMatches] = useState<SupplierMatch[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [added, setAdded] = useState<string[]>(profile.supplierIds);

  const place = profile.location;

  useEffect(() => {
    if (!place) return;
    let live = true;
    onboardingApi
      .matchSuppliers({ place, categories: profile.categories, buying: profile.buying })
      .then((m) => {
        if (!live) return;
        setMatches(m);
        // Pre-add the best two so the button is useful; the trader can undo.
        if (profile.supplierIds.length === 0) setAdded(m.slice(0, 2).map((x) => x.id));
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [place, profile.categories, profile.buying, profile.supplierIds.length]);

  const toggle = (id: string) => setAdded((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  function finish() {
    updateProfile({ supplierIds: added });
    finishOnboarding();
  }

  return (
    <StepScaffold
      step="suppliers"
      title="Suppliers for you"
      why={[
        'These suppliers deliver to you (or are close enough to collect from) and sell what you buy.',
        'The best matches come first. Each card says why it was picked. Add the ones you want to order from; you can change this any time in the Suppliers tab.',
      ]}
      primaryLabel={added.length ? `Open my business · ${added.length} supplier${added.length > 1 ? 's' : ''}` : 'Open my business'}
      onPrimary={finish}>
      {!matches && !failed ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accentDeep} />
          <Text style={styles.muted}>Finding suppliers near you…</Text>
        </View>
      ) : null}

      {failed ? <Text style={styles.muted}>Couldn&apos;t load suppliers. You&apos;ll find them in the Suppliers tab.</Text> : null}

      {matches && matches.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.name}>We&apos;re not in your area yet</Text>
          <Text style={styles.muted}>
            No supplier we work with reaches you or sells your categories yet. We&apos;ll let you know when one does. Your business tools
            work now.
          </Text>
        </View>
      ) : null}

      {matches && matches.length > 0 ? (
        <Text style={styles.count}>
          {matches.length} match{matches.length > 1 ? 'es' : ''} for you
        </Text>
      ) : null}

      {matches?.map((m, i) => {
        const on = added.includes(m.id);
        return (
          <View key={m.id} style={[styles.card, on && styles.cardOn]}>
            <View style={styles.row}>
              <View style={[styles.logo, { backgroundColor: m.color }]}>
                <Text style={styles.logoText}>{m.initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{m.name}</Text>
                  {i === 0 ? <Text style={styles.best}>Best match</Text> : null}
                </View>
                <Text style={styles.muted}>
                  {m.area} · {m.distanceKm.toFixed(1)} km
                </Text>
              </View>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`Add ${m.name}`}
                onPress={() => toggle(m.id)}
                style={[styles.add, on && styles.addOn]}>
                <Feather name={on ? 'check' : 'plus'} size={18} color={on ? colors.white : colors.ink} />
              </Pressable>
            </View>
            <View style={styles.reasons}>
              {m.reasons.map((r) => (
                <View key={r} style={styles.reason}>
                  <Feather name="check" size={14} color={colors.accentDeep} />
                  <Text style={styles.reasonText}>{r}</Text>
                </View>
              ))}
              {m.caution ? (
                <View style={styles.reason}>
                  <Feather name="alert-circle" size={14} color={colors.marigoldDeep} />
                  <Text style={[styles.reasonText, { color: colors.marigoldDeep }]}>{m.caution}</Text>
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
    </StepScaffold>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  muted: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  count: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1, color: colors.textMuted, textTransform: 'uppercase', marginBottom: -8 },
  card: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 4 },
  cardOn: { borderColor: colors.accent, borderWidth: 1.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 46, height: 46, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.white },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  best: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.accentDeep,
    backgroundColor: colors.accentTint,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  add: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  addOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  reasons: { gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line },
  reason: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  reasonText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.text },
});
