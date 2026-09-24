import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { Card, IconTile, InfoNote, Tag } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Body, Overline, Title } from '@/shared/components/Text';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { mockPaymentCardsApi as cardsApi } from '../api/mockPaymentCardsApi';
import { BRAND_LABEL, SavedCard } from '../types';

const RESULT_MESSAGE: Record<string, string> = {
  approved: 'Card added.',
  declined: 'Your bank declined that card. Nothing was saved.',
  cancelled: 'No card was added.',
};

/** More -> Payment cards: the cards this business pays suppliers with in the app. */
export default function PaymentCardsScreen() {
  const { result } = useLocalSearchParams<{ result?: string }>();
  const [cards, setCards] = useState<SavedCard[] | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    cardsApi.list().then(setCards);
  }, []);
  useFocusEffect(load);

  async function act(id: string, fn: () => Promise<void>) {
    setBusy(id);
    try {
      await fn();
      setConfirming(null);
      load();
    } finally {
      setBusy(null);
    }
  }

  async function add() {
    const { sessionId } = await cardsApi.beginAdd();
    router.push({ pathname: '/informal-business/payment-cards/add', params: { session: sessionId } });
  }

  return (
    <Screen back footer={<Button title="Add a card" icon="plus" onPress={add} />}>
      <View style={styles.head}>
        <Title>Payment cards</Title>
        <Tag label="Test mode" tone="marigold" />
      </View>
      <Body>Pay your suppliers in the app. Your card details stay with the payment provider.</Body>

      {result && RESULT_MESSAGE[result] ? (
        <View style={[styles.note, result === 'declined' && styles.noteBad]}>
          <Feather name={result === 'approved' ? 'check-circle' : 'info'} size={14} color={result === 'declined' ? colors.garnet : colors.ink} />
          <Text style={styles.noteText}>{RESULT_MESSAGE[result]}</Text>
        </View>
      ) : null}

      <Overline>Your cards</Overline>
      {!cards ? (
        <ActivityIndicator color={colors.accent} />
      ) : cards.length === 0 ? (
        <Card>
          <View style={styles.empty}>
            <IconTile name="credit-card" size={44} />
            <Text style={styles.emptyText}>No cards yet. Add one to pay suppliers in the app.</Text>
          </View>
        </Card>
      ) : (
        cards.map((c) => (
          <Card key={c.id} style={{ gap: 12 }}>
            <View style={styles.row}>
              <IconTile name="credit-card" size={40} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>
                  {BRAND_LABEL[c.brand]} •••• {c.last4}
                </Text>
                <Text style={styles.cardSub}>
                  Expires {String(c.expMonth).padStart(2, '0')}/{String(c.expYear).slice(-2)}
                </Text>
              </View>
              {c.isDefault ? <Tag label="Default" tone="jade" /> : null}
            </View>

            {confirming === c.id ? (
              <View style={styles.confirm}>
                <Text style={styles.confirmText}>Remove this card?</Text>
                <View style={styles.actions}>
                  <Pressable onPress={() => setConfirming(null)} style={styles.action}>
                    <Text style={styles.actionText}>Keep</Text>
                  </Pressable>
                  <Pressable onPress={() => act(c.id, () => cardsApi.remove(c.id))} style={styles.action}>
                    {busy === c.id ? <ActivityIndicator size="small" color={colors.garnet} /> : <Text style={[styles.actionText, styles.danger]}>Remove</Text>}
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.actions}>
                {!c.isDefault ? (
                  <Pressable onPress={() => act(c.id, () => cardsApi.setDefault(c.id))} style={styles.action}>
                    <Text style={styles.actionText}>Make default</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => setConfirming(c.id)} style={styles.action}>
                  <Text style={[styles.actionText, styles.danger]}>Remove</Text>
                </Pressable>
              </View>
            )}
          </Card>
        ))
      )}

      <InfoNote icon="lock">
        Akayza never sees or stores your card number. You add a card on the payment provider&apos;s secure page; we keep only a reference to it, and the last 4 digits so you can tell your cards apart.
      </InfoNote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  note: { flexDirection: 'row', gap: 8, backgroundColor: colors.iconTile, borderRadius: radius.sm, padding: 12 },
  noteBad: { backgroundColor: colors.garnetTint },
  noteText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  emptyText: { fontFamily: fonts.body, fontSize: 13.5, color: colors.textMuted, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardName: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  cardSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  confirm: { gap: 6 },
  confirmText: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  action: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, minWidth: 80, alignItems: 'center' },
  actionText: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  danger: { color: colors.garnet },
});
