import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { centsToInput } from '@/features/dashboard/informal-business/credit-book/lib/amounts';
import { Button } from '@/shared/components/Button';
import { Card, IconTile } from '@/shared/components/Parts';
import { Sheet } from '@/shared/components/Sheet';
import { formatRand } from '@/shared/lib/money';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { ItemButton } from '../components/ItemButton';
import { take, useCounter } from '../lib/counterStore';
import { add, Cart, count, label, lines as toLines, linesText, NAME_MAX, PAYMENT_LABEL, remove, total } from '../lib/orders';
import type { Order, Payment } from '../types';

/**
 * New order (the main screen): tap the items (tap again = +1), see the
 * total, tap how they paid. Two or three taps for a queue of hungry people.
 * "Pay later" offers to put it in the credit book.
 */
export function NewOrderTab() {
  const { menu, orders } = useCounter();
  const [cart, setCart] = useState<Cart>({});
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);
  const [later, setLater] = useState<Order | null>(null);

  if (!menu) return null;
  if (menu.length === 0) {
    return (
      <Card style={styles.center}>
        <IconTile name="list" size={48} />
        <Text style={styles.title}>Set up your menu first</Text>
        <Text style={styles.muted}>Pick a starter menu (kotas, plates, burgers) and change the prices. It takes 30 seconds.</Text>
        <Button title="Set up the menu" icon="edit-3" onPress={() => router.push('/informal-business/order-book/menu')} />
      </Card>
    );
  }

  const ls = toLines(cart, menu);
  const last = lastId ? orders.find((o) => o.id === lastId) : undefined;

  async function pay(payment: Payment) {
    if (busy || ls.length === 0) return;
    setBusy(true);
    const order = await take(ls, payment, name);
    setCart({});
    setName('');
    setLastId(order.id);
    setBusy(false);
    if (payment === 'later') setLater(order);
  }

  return (
    <>
      {last ? (
        <View style={styles.done} accessibilityLiveRegion="polite">
          <Feather name="check-circle" size={20} color={colors.jade} />
          <Text style={styles.doneText}>
            Order {label(last)} · {formatRand(last.totalCents)} · {PAYMENT_LABEL[last.payment]}
          </Text>
        </View>
      ) : null}

      <View style={styles.grid}>
        {menu.map((m) => (
          <ItemButton key={m.id} item={m} qty={cart[m.id] ?? 0} onAdd={() => setCart((c) => add(c, m.id))} onRemove={() => setCart((c) => remove(c, m.id))} />
        ))}
      </View>

      <Card style={{ gap: 12 }}>
        <View style={styles.totalRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.small}>{ls.length ? `${count(ls)} item${count(ls) === 1 ? '' : 's'}` : 'Tap the items to add them'}</Text>
            {ls.length ? (
              <Text style={styles.summary} numberOfLines={2}>
                {linesText(ls)}
              </Text>
            ) : null}
          </View>
          <Text style={styles.total} accessibilityLabel={`Total ${formatRand(total(ls))}`}>
            {formatRand(total(ls))}
          </Text>
        </View>
        {ls.length ? (
          <>
            <TextInput
              accessibilityLabel="Name for the queue (optional)"
              value={name}
              onChangeText={setName}
              placeholder="Name for the queue (optional)"
              placeholderTextColor={colors.textFaint}
              maxLength={NAME_MAX}
              style={styles.name}
            />
            <Button title="Paid cash" icon="dollar-sign" loading={busy} onPress={() => pay('cash')} />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Button title="Card or EFT" variant="secondary" onPress={() => pay('digital')} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Pay later" variant="secondary" onPress={() => pay('later')} />
              </View>
            </View>
            <Pressable accessibilityRole="button" onPress={() => setCart({})} style={styles.clear}>
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          </>
        ) : null}
      </Card>

      {later ? (
        <Sheet visible onClose={() => setLater(null)}>
          <Text style={styles.sheetTitle}>Put {formatRand(later.totalCents)} in the credit book?</Text>
          <Text style={styles.body}>
            {later.customerName ? `${later.customerName} pays later.` : 'They pay later.'} The credit book keeps it and reminds them on WhatsApp.
          </Text>
          <Button
            title="Yes, add to the credit book"
            icon="book"
            onPress={() => {
              // The order as it is now: by the time they tap, the server has usually numbered it.
              const o = orders.find((x) => x.id === later.id) ?? later;
              setLater(null);
              router.push({
                pathname: '/informal-business/credit-book/new',
                params: { amount: centsToInput(o.totalCents), description: `Order ${label(o)}: ${linesText(o.lines)}`.slice(0, 120), name: o.customerName ?? '' },
              });
            }}
          />
          <Button title="Not now" variant="secondary" onPress={() => setLater(null)} />
        </Sheet>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  muted: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  done: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.jadeTint, borderRadius: radius.sm, padding: 12 },
  doneText: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.jade },
  totalRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  small: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textMuted },
  summary: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.text, marginTop: 2 },
  total: { fontFamily: fonts.display, fontSize: 30, color: colors.ink },
  name: {
    height: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.white,
  },
  row: { flexDirection: 'row', gap: 10 },
  clear: { alignSelf: 'center', minHeight: 36, justifyContent: 'center', paddingHorizontal: 12 },
  clearText: { fontFamily: fonts.bold, fontSize: 14, color: colors.textMuted },
  sheetTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.text },
});
