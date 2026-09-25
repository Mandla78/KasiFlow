import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Title } from '@/shared/components/Text';
import { formatRand } from '@/shared/lib/money';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { ordersApi } from '../../orders/api/ordersApi';
import { Order, OrderError } from '../../orders/types';

type Step = 'ready' | 'opening' | 'checking' | 'paid' | 'not_yet' | 'soon';

/** After the browser closes, ask for the order a few times: PayFast's
 *  confirmation usually lands within seconds. */
const CHECKS = 6;
const CHECK_EVERY_MS = 2500;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Digital payment for one order: card or instant EFT on PayFast's secure
 * page, opened in the phone's browser. The app never sees card details,
 * the amount it sends or any key: it gets a one-time pay link from our
 * server. The order is paid only when PayFast's verified notification
 * reaches the server -- this screen just asks the server afterwards.
 */
export default function PaymentScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [failed, setFailed] = useState(false);
  const [step, setStep] = useState<Step>('ready');
  const [error, setError] = useState('');

  useEffect(() => {
    if (orderId) ordersApi.get(orderId).then(setOrder).catch(() => setFailed(true));
  }, [orderId]);

  async function pay() {
    if (!order) return;
    setError('');
    setStep('opening');
    try {
      const url = await ordersApi.startPayment(order.id);
      if (!url) {
        setStep('soon');
        return;
      }
      await WebBrowser.openBrowserAsync(url);
      setStep('checking');
      for (let i = 0; i < CHECKS; i++) {
        const now = await ordersApi.get(order.id);
        setOrder(now);
        if (now.status !== 'awaiting_payment') {
          setStep('paid');
          return;
        }
        await pause(CHECK_EVERY_MS);
      }
      setStep('not_yet');
    } catch (e) {
      setError(e instanceof OrderError ? e.message : "Couldn't open the payment. Check your connection and try again.");
      setStep('ready');
    }
  }

  if (!order) {
    return (
      <Screen back>
        {failed ? <Text style={styles.muted}>Couldn&apos;t load this order.</Text> : <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />}
      </Screen>
    );
  }

  const open = () => router.replace(`/informal-business/orders/${order.id}`);
  const waiting = order.status === 'awaiting_payment';
  const footer =
    step === 'paid' || !waiting ? (
      <Button title="View my order" onPress={open} />
    ) : (
      <>
        <Button
          title={step === 'not_yet' ? 'Pay again' : `Pay ${formatRand(order.totalCents)} securely`}
          icon="lock"
          onPress={pay}
          loading={step === 'opening' || step === 'checking'}
          disabled={step === 'soon'}
        />
        <Button title="View my order" variant="secondary" onPress={open} />
      </>
    );

  return (
    <Screen back footer={footer}>
      <View style={{ gap: 4 }}>
        <Title>Secure payment</Title>
        <Text style={styles.muted}>
          {order.reference} · {order.supplierName}
        </Text>
      </View>

      <Card style={styles.amountCard}>
        <Text style={styles.muted}>{step === 'paid' ? 'Paid' : 'To pay'}</Text>
        <Text style={styles.amount}>{formatRand(order.totalCents)}</Text>
        <Text style={styles.muted}>Card or instant EFT, on PayFast&apos;s secure page</Text>
      </Card>

      {step === 'checking' ? (
        <Note icon="clock" title="Confirming your payment" text="Checking with PayFast. This usually takes a few seconds." />
      ) : step === 'paid' ? (
        <Note
          icon="check-circle"
          title="Paid and confirmed"
          text={`${order.supplierName} has your order. We've emailed your receipt, and we'll let you know when it's ${order.fulfilment === 'collect' ? 'ready to collect' : 'on its way'}.`}
          good
        />
      ) : step === 'not_yet' ? (
        <Note
          icon="info"
          title="Not confirmed yet"
          text="If you paid, it will show in My orders as soon as PayFast confirms it. If you cancelled, you can pay again until the order lapses (24 hours after you placed it)."
        />
      ) : step === 'soon' ? (
        <Note icon="lock" title="Coming soon" text={`Digital payment isn't switched on here yet. Your order is saved; ${order.supplierName} gets it once it's paid.`} />
      ) : (
        <Note icon="shield" title="How it works" text="You pay on PayFast's own page; Akayza never sees your card. Once PayFast confirms the payment, your order is confirmed straight away." />
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

function Note({ icon, title, text, good }: { icon: 'clock' | 'check-circle' | 'info' | 'lock' | 'shield'; title: string; text: string; good?: boolean }) {
  return (
    <View style={[styles.note, good && styles.noteGood]}>
      <Feather name={icon} size={22} color={good ? colors.jade : colors.accentDeep} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.noteTitle}>{title}</Text>
        <Text style={styles.noteText}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  amountCard: { alignItems: 'center', gap: 4, paddingVertical: 22 },
  amount: { fontFamily: fonts.display, fontSize: 32, color: colors.ink },
  note: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: colors.accentTint, borderRadius: radius.md, padding: 14 },
  noteGood: { backgroundColor: colors.jadeTint },
  noteTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink },
  noteText: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.text },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.garnet, backgroundColor: colors.garnetTint, borderRadius: radius.sm, padding: 12 },
});
