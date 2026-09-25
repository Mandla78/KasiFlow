import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import type { Place } from '@/features/auth/types';
import { useSession } from '@/features/auth/session/SessionProvider';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Sheet } from '@/shared/components/Sheet';
import { Overline } from '@/shared/components/Text';
import { AddressPickerField, formatPlace } from '@/shared/location-picker/components/AddressPickerField';
import { formatRand } from '@/shared/lib/money';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { clearCart, estimatedTotal, useCart } from '../../cart/lib/cartStore';
import { ordersApi } from '../../orders/api/ordersApi';
import { CASH_RULES, cashLimitFor, MAX_OPEN_CASH_ORDERS } from '../../orders/lib/cashPolicy';
import { isActive } from '../../orders/lib/status';
import { Fulfilment, OrderError, PaymentMethod } from '../../orders/types';
import { supplierApi } from '../../suppliers/api/supplierApi';
import type { Supplier } from '../../suppliers/types';
import { OptionCard } from '../components/OptionCard';
import { StepHeader } from '../components/StepHeader';

type Where = 'business' | 'other';
const TITLES = ['How you get it', 'How you pay', 'Check and place your order'];

/**
 * Checkout in three steps: 1 delivery or collection (and where to),
 * 2 how to pay, 3 review and place. The server prices the order again when
 * it's placed; what's shown here is the estimate.
 * Paying: digital (card / instant EFT) is recommended and goes on to the
 * secure payment step. Cash shows whenever the supplier takes it and is
 * never greyed out; if this order breaks a cash rule, choosing it says
 * which one and how to fix it (../../orders/lib/cashPolicy).
 */
export default function CheckoutScreen() {
  const { supplierId } = useLocalSearchParams<{ supplierId: string }>();
  const { profile } = useSession();
  const { lines } = useCart(supplierId ?? '');
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [step, setStep] = useState(1);
  const [fulfilment, setFulfilment] = useState<Fulfilment | null>(null);
  const [where, setWhere] = useState<Where>('business');
  const [otherPlace, setOtherPlace] = useState<Place | null>(null);
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [openCash, setOpenCash] = useState(0);
  const [cashHelp, setCashHelp] = useState(false);

  useEffect(() => {
    // Cash orders still waiting (placed, not yet delivered or collected).
    ordersApi
      .list()
      .then((all) => setOpenCash(all.filter((o) => o.payment === 'cash' && isActive(o)).length))
      .catch(() => setOpenCash(0));
  }, []);

  useEffect(() => {
    if (!supplierId) return;
    supplierApi.get(supplierId).then((s) => {
      setSupplier(s);
      // Defaults from what the trader told us at sign-up.
      setFulfilment(s.delivers && profile.buying.fulfilment !== 'collect' ? 'delivery' : s.collect ? 'collect' : 'delivery');
      // Digital is the default: it's tracked and safest for both sides.
      setPayment(s.payfast ? 'in_app' : 'cash');
    });
  }, [supplierId, profile.buying.fulfilment]);

  if (!supplier || !fulfilment || !payment) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />
      </Screen>
    );
  }

  const subtotal = estimatedTotal(lines);
  const free = supplier.freeDeliveryOverCents !== null && subtotal >= supplier.freeDeliveryOverCents;
  const deliveryFee = fulfilment === 'delivery' && !free ? supplier.deliveryFeeCents : 0;
  const total = subtotal + deliveryFee;
  const cashLimit = cashLimitFor(supplier);
  const overCashLimit = cashLimit !== null && total > cashLimit;
  const tooManyCash = openCash >= MAX_OPEN_CASH_ORDERS;
  const cashProblem =
    cashLimit === null
      ? ''
      : overCashLimit
        ? `Cash is up to ${formatRand(cashLimit)} per order and this order is ${formatRand(total)}. Pay digitally, or remove ${formatRand(total - cashLimit)} to pay cash.`
        : tooManyCash
          ? `You have ${openCash} cash orders waiting. Once one is delivered or collected, you can pay cash again. Pay digitally for this one.`
          : '';
  const cashTitle = fulfilment === 'collect' ? 'Cash when you collect' : 'Cash on delivery';
  const businessAddress = profile.location ? formatPlace(profile.location) : '';
  const deliveryAddress = where === 'other' && otherPlace ? formatPlace(otherPlace) : businessAddress;
  const hours = supplier.hours.map((h) => `${h.days} ${h.open}-${h.close}`).join(', ');

  const stepError =
    step === 1 && fulfilment === 'delivery' && where === 'other' && !otherPlace
      ? 'Set the delivery address, or choose your business address.'
      : step === 2 && payment === 'cash' && cashProblem
        ? cashProblem
        : '';

  function back() {
    if (step > 1) setStep(step - 1);
    else router.back();
  }

  async function place() {
    if (!supplier || !fulfilment || !payment) return;
    setBusy(true);
    setError('');
    try {
      const order = await ordersApi.place({
        supplierId: supplier.id,
        lines: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
        fulfilment,
        payment,
        deliveryAddress: fulfilment === 'delivery' ? deliveryAddress : null,
      });
      clearCart(supplier.id);
      router.dismissAll();
      // Digital: on to the secure payment step. Cash: the order, waiting for the supplier.
      router.push(order.status === 'awaiting_payment' ? `/informal-business/pay/${order.id}` : `/informal-business/orders/${order.id}`);
    } catch (e) {
      setError(e instanceof OrderError ? e.message : "Couldn't place the order. Check your connection and try again.");
      setBusy(false);
    }
  }

  const footer =
    step < 3 ? (
      <Button title="Continue" onPress={() => !stepError && setStep(step + 1)} disabled={!!stepError} />
    ) : (
      <Button title={payment === 'in_app' ? `Place order and pay · ${formatRand(total)}` : `Place order · ${formatRand(total)}`} onPress={place} loading={busy} />
    );

  return (
    <Screen footer={footer}>
      <StepHeader step={step} total={3} title={TITLES[step - 1]} onBack={back} />
      <Text style={styles.muted}>
        {supplier.name} · estimated {formatRand(total)}
      </Text>

      {step === 1 ? (
        <View style={{ gap: 8 }}>
          <OptionCard
            icon="truck"
            title={`Deliver${deliveryFee ? ` · ${formatRand(deliveryFee)}` : ' · free'}`}
            line={supplier.delivers ? `Within ${supplier.deliveryRadiusKm} km of ${supplier.area}` : "This supplier doesn't deliver"}
            selected={fulfilment === 'delivery'}
            disabled={!supplier.delivers}
            onPress={() => setFulfilment('delivery')}
          />
          <OptionCard
            icon="map-pin"
            title="I'll collect"
            line={supplier.collect ? `${supplier.address} · ${hours}` : "This supplier doesn't do collection"}
            selected={fulfilment === 'collect'}
            disabled={!supplier.collect}
            onPress={() => setFulfilment('collect')}
          />
          {fulfilment === 'delivery' ? (
            <>
              <Overline>Deliver to</Overline>
              <OptionCard
                icon="home"
                title="My business"
                line={businessAddress || 'Your business address'}
                selected={where === 'business'}
                onPress={() => setWhere('business')}
              />
              <OptionCard icon="navigation" title="Somewhere else" line="A site, a second shop, a home" selected={where === 'other'} onPress={() => setWhere('other')} />
              {where === 'other' ? (
                <AddressPickerField label="Delivery address" value={otherPlace} onChange={setOtherPlace} mapTitle="Where to deliver" confirmLabel="Deliver here" />
              ) : null}
            </>
          ) : null}
        </View>
      ) : null}

      {step === 2 ? (
        <View style={{ gap: 8 }}>
          <OptionCard
            icon="credit-card"
            title="Digital payment"
            badge={supplier.payfast ? 'Recommended' : undefined}
            line={supplier.payfast ? 'Card or instant EFT on a secure payment page' : "This supplier doesn't take digital payment"}
            selected={payment === 'in_app'}
            disabled={!supplier.payfast}
            onPress={() => setPayment('in_app')}
          />
          {/* No cash option at all when the supplier doesn't take cash. */}
          {cashLimit !== null ? (
            <OptionCard
              icon="dollar-sign"
              title={cashTitle}
              line={`This supplier accepts cash up to ${formatRand(cashLimit)} per order. They accept the order first.`}
              selected={payment === 'cash'}
              onPress={() => setPayment('cash')}
            />
          ) : null}
          {cashLimit !== null ? (
            <Text style={styles.link} onPress={() => setCashHelp(true)} accessibilityRole="button">
              How cash works
            </Text>
          ) : null}
        </View>
      ) : null}

      {step === 3 ? (
        <View style={{ gap: 12 }}>
          <Card style={{ gap: 10 }}>
            <Summary label={fulfilment === 'collect' ? 'Collect at' : 'Deliver to'} value={fulfilment === 'collect' ? `${supplier.address} (${hours})` : deliveryAddress} onEdit={() => setStep(1)} />
            <View style={styles.divider} />
            <Summary
              label="Pay"
              value={payment === 'in_app' ? 'Digital payment: you pay on the next screen' : `${cashTitle}, once ${supplier.name} accepts the order`}
              onEdit={() => setStep(2)}
            />
          </Card>
          <Card style={{ gap: 10 }}>
            {lines.map((l) => (
              <View key={l.productId} style={styles.row}>
                <Text style={styles.item} numberOfLines={1}>
                  {l.qty} × {l.name}
                </Text>
                <Text style={styles.amount}>{formatRand(l.seenPriceCents * l.qty)}</Text>
              </View>
            ))}
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.item}>Delivery</Text>
              <Text style={styles.amount}>{fulfilment === 'collect' ? '—' : deliveryFee ? formatRand(deliveryFee) : 'Free'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.total}>{formatRand(total)}</Text>
            </View>
          </Card>
          <Text style={styles.small}>The supplier&apos;s prices when you place the order are the ones that count; your order shows the final total.</Text>
        </View>
      ) : null}

      {stepError ? <Text style={styles.error}>{stepError}</Text> : null}
      <Sheet visible={cashHelp} onClose={() => setCashHelp(false)}>
        <Text style={styles.sheetTitle}>How cash works</Text>
        {CASH_RULES.map((r) => (
          <Text key={r} style={styles.rule}>
            •  {r}
          </Text>
        ))}
        <Text style={styles.small}>Digital payment has no limit and your order goes straight to the supplier once it&apos;s paid.</Text>
        <Button title="Got it" variant="secondary" onPress={() => setCashHelp(false)} />
      </Sheet>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

function Summary({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <View style={{ gap: 2 }}>
      <View style={styles.row}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <Text style={styles.change} onPress={onEdit}>
          Change
        </Text>
      </View>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  item: { flex: 1, fontFamily: fonts.medium, fontSize: 13.5, color: colors.text },
  amount: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  divider: { height: 1, backgroundColor: colors.line },
  link: { fontFamily: fonts.bold, fontSize: 13, color: colors.accentDeep, paddingVertical: 4 },
  sheetTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.ink },
  rule: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.text },
  totalLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  total: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  summaryLabel: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textMuted },
  summaryValue: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.text },
  change: { fontFamily: fonts.bold, fontSize: 13, color: colors.accentDeep },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.garnet, backgroundColor: colors.garnetTint, borderRadius: radius.sm, padding: 12 },
  small: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textMuted },
});
