import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { addDays } from '@/features/dashboard/informal-business/credit-book/lib/dueDates';
import { Card } from '@/shared/components/Parts';
import { Overline } from '@/shared/components/Text';
import { formatRand } from '@/shared/lib/money';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { orderBookApi } from '../api/orderBookApi';
import { useCounter } from '../lib/counterStore';
import { busiestHour, dayTotals, moneyIn } from '../lib/orders';
import type { DayTotals } from '../types';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayName = (iso: string) => DAY_NAMES[new Date(`${iso}T12:00:00Z`).getUTCDay()]!;

/**
 * Today in numbers -- the trader's own value: orders, the money they
 * recorded (cash and card or EFT, as they tapped it; "pay later" is on the
 * credit book), best sellers, the busiest hour; and the same for the week.
 * It's their own record, so it says "recorded", never "verified" or "paid":
 * only a payment the provider verified is proof (CONTRACT_order_book DECISION).
 */
export function TodayTab() {
  const { day, orders } = useCounter();
  const [week, setWeek] = useState<DayTotals[] | null>(null);
  const [weekFailed, setWeekFailed] = useState(false);
  const t = dayTotals(day, orders);
  const busy = busiestHour(t);

  useEffect(() => {
    let live = true;
    orderBookApi
      .week(day)
      .then((w) => live && setWeek(w))
      .catch(() => live && setWeekFailed(true));
    return () => {
      live = false;
    };
  }, [day, orders.length]);

  // Today from the counter (it includes orders not sent yet); the other days from the server.
  const days = week ? [...week.slice(0, -1), t] : null;
  const top = Math.max(1, ...(days ?? []).map(moneyIn));
  // 06:00 to 22:00, stretched to any hour with orders (late-night trade shows too).
  const traded = t.byHour.map((n, h) => (n > 0 ? h : -1)).filter((h) => h >= 0);
  const from = Math.min(6, ...traded);
  const to = Math.max(22, ...traded.map((h) => h + 1));
  const hours = t.byHour.slice(from, to);
  const peak = Math.max(1, ...hours);
  const hh = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;

  return (
    <>
      <View style={styles.tiles}>
        <Tile value={String(t.orders)} label={t.orders === 1 ? 'order today' : 'orders today'} />
        <Tile value={formatRand(moneyIn(t))} label="money you recorded" />
      </View>

      <Card style={{ gap: 10 }}>
        <Row label="Cash" value={formatRand(t.cashCents)} />
        <Row label="Card or EFT" value={formatRand(t.digitalCents)} />
        <Row label="Pay later (credit book)" value={formatRand(t.laterCents)} muted />
        <Text style={styles.small}>As you recorded them at the counter: your own record, not a bank statement.</Text>
      </Card>

      <View style={styles.section}>
        <Overline>Best sellers</Overline>
        {t.bestSellers.length ? (
          <Card style={{ gap: 10 }}>
            {t.bestSellers.map((b, i) => (
              <Row key={b.name} label={`${i + 1}. ${b.name}`} value={`${b.qty} sold`} />
            ))}
          </Card>
        ) : (
          <Text style={styles.muted}>Your best sellers show up after the first orders.</Text>
        )}
      </View>

      <View style={styles.section}>
        <Overline>Busiest hour</Overline>
        <Card style={{ gap: 10 }}>
          <Text style={styles.big}>{busy ? `${busy.text} · ${busy.orders} order${busy.orders === 1 ? '' : 's'}` : 'Not yet today'}</Text>
          <View style={styles.bars} accessible accessibilityLabel={`Orders per hour, ${hh(from)} to ${hh(to)}`}>
            {hours.map((n, i) => (
              <View key={i} style={styles.barSlot}>
                <View style={[styles.bar, { height: 4 + (n / peak) * 56 }, n === peak && n > 0 && styles.barPeak]} />
              </View>
            ))}
          </View>
          <View style={styles.axis}>
            <Text style={styles.axisText}>{hh(from)}</Text>
            <Text style={styles.axisText}>{hh(Math.round((from + to) / 2))}</Text>
            <Text style={styles.axisText}>{hh(to)}</Text>
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <Overline>This week</Overline>
        {days ? (
          <Card style={{ gap: 10 }}>
            {days.map((d) => (
              <View key={d.day} style={styles.weekRow}>
                <Text style={[styles.weekDay, d.day === day && styles.bold]}>{d.day === day ? 'Today' : dayName(d.day)}</Text>
                <View style={styles.weekBarTrack}>
                  <View style={[styles.weekBar, { width: `${(moneyIn(d) / top) * 100}%` }]} />
                </View>
                <Text style={[styles.weekValue, d.day === day && styles.bold]}>{formatRand(moneyIn(d))}</Text>
                <Text style={styles.weekOrders}>{d.orders}</Text>
              </View>
            ))}
            <Text style={styles.small}>Money you recorded per day, and the number of orders. From {dayName(addDays(day, -6))} to today.</Text>
          </Card>
        ) : (
          <Text style={styles.muted}>{weekFailed ? 'The week needs a signal. Today above is from this phone.' : 'Loading the week…'}</Text>
        )}
      </View>
    </>
  );
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, muted && { color: colors.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.rowValue, muted && { color: colors.textMuted }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 2 },
  tileValue: { fontFamily: fonts.display, fontSize: 26, color: colors.ink },
  tileLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  rowLabel: { flex: 1, fontFamily: fonts.semibold, fontSize: 14.5, color: colors.text },
  rowValue: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink },
  section: { gap: 8 },
  muted: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted },
  small: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textMuted },
  big: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 62, gap: 3 },
  barSlot: { flex: 1, justifyContent: 'flex-end' },
  bar: { borderRadius: 3, backgroundColor: colors.accentTint },
  barPeak: { backgroundColor: colors.accent },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  axisText: { fontFamily: fonts.medium, fontSize: 11, color: colors.textFaint },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  weekDay: { width: 44, fontFamily: fonts.medium, fontSize: 13.5, color: colors.text },
  weekBarTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.iconTile, overflow: 'hidden' },
  weekBar: { height: 10, borderRadius: 5, backgroundColor: colors.jade },
  weekValue: { width: 72, textAlign: 'right', fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  weekOrders: { width: 24, textAlign: 'right', fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted },
  bold: { fontFamily: fonts.bold },
});
