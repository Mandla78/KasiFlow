import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/shared/components/Screen';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { completeTestPayment, TEST_CARDS } from '../api/mockPaymentCardsApi';
import { BRAND_LABEL } from '../types';

/**
 * PRACTICE stand-in for the payment provider's secure page (mock only).
 * The real page belongs to the provider and opens in the in-app browser;
 * card numbers are typed there, never into Akayza. This one only lets you
 * pick an outcome, so there is deliberately no card-number field.
 */
export default function TestPaymentPageScreen() {
  const { session } = useLocalSearchParams<{ session: string }>();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function finish(cardId: string | null) {
    setBusy(cardId ?? 'cancel');
    setError('');
    try {
      const result = await completeTestPayment(session ?? '', cardId);
      router.dismissTo({ pathname: '/informal-business/payment-cards', params: { result } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setBusy(null);
    }
  }

  return (
    <Screen back>
      <View style={styles.bar}>
        <Feather name="lock" size={14} color={colors.jade} />
        <Text style={styles.barText}>Secure payment page</Text>
      </View>
      <View style={styles.banner}>
        <Feather name="alert-triangle" size={15} color={colors.marigoldDeep} />
        <Text style={styles.bannerText}>
          Practice page. No real card is used. When payments go live, you&apos;ll type your card on the payment provider&apos;s own page.
        </Text>
      </View>

      <Text style={styles.heading}>Choose a test card</Text>
      <View style={styles.list}>
        {TEST_CARDS.map((c) => (
          <Pressable key={c.id} onPress={() => finish(c.id)} disabled={!!busy} style={({ pressed }) => [styles.option, pressed && { opacity: 0.7 }]}>
            <Feather name="credit-card" size={20} color={colors.ink} />
            <View style={{ flex: 1 }}>
              <Text style={styles.optionTitle}>
                {BRAND_LABEL[c.brand]} •••• {c.last4}
              </Text>
              <Text style={[styles.optionSub, c.outcome === 'declined' && { color: colors.garnet }]}>{c.note}</Text>
            </View>
            {busy === c.id ? <ActivityIndicator color={colors.accent} /> : <Feather name="chevron-right" size={18} color={colors.textFaint} />}
          </Pressable>
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable onPress={() => finish(null)} disabled={!!busy} style={styles.cancel}>
        <Text style={styles.cancelText}>Cancel and go back</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', backgroundColor: colors.jadeTint, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  barText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.jade },
  banner: { flexDirection: 'row', gap: 10, backgroundColor: colors.marigoldTint, borderRadius: radius.sm, padding: 12 },
  bannerText: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 18, color: colors.text },
  heading: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  list: { gap: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: 14,
  },
  optionTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  optionSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.garnet },
  cancel: { alignItems: 'center', paddingVertical: 10 },
  cancelText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.textMuted, textDecorationLine: 'underline' },
});
