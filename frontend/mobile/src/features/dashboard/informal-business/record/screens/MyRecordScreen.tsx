import { Feather } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useSession } from '@/features/auth/session/SessionProvider';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Overline, Title } from '@/shared/components/Text';
import { colors, fonts } from '@/shared/theme/tokens';

import { recordApi } from '../api/recordApi';
import { addMonths, monthLabel, thisMonth } from '../lib/months';
import { HIDDEN, RecordBlock, RecordLine, recordView } from '../lib/view';
import type { RecordSummary } from '../types';

const OPENS: Record<RecordBlock['key'], Href | null> = {
  orders: null, // each line opens its own orders
  creditBook: '/informal-business/credit-book',
  jobs: '/informal-business/jobs' as Href,
};

/**
 * My record (plan v2 03): one month of your money in three blocks that are
 * never added together, each opening where its numbers come from. The eye
 * hides the amounts (someone looking over your shoulder).
 */
export default function MyRecordScreen() {
  const { profile } = useSession();
  const [month, setMonth] = useState(thisMonth());
  const [record, setRecord] = useState<RecordSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let live = true;
    recordApi
      .summary(month)
      .then((r) => live && setRecord(r))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [month, attempt]);

  const go = (m: string) => {
    setFailed(false);
    setMonth(m);
  };
  const first = record?.firstMonth ?? month;
  const now = thisMonth();
  // The last answer stays up while the next month loads; only this month's is shown.
  const view = record && record.month === month ? recordView(record, { tools: profile.tools, hidden, builder: profile.businessType === 'builder' }) : null;
  const openOrders = (line: RecordLine) =>
    line.evidence && router.push({ pathname: '/informal-business/orders', params: { evidence: line.evidence, month } });

  return (
    <Screen back>
      <View style={styles.header}>
        <Title>My record</Title>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={hidden ? 'Show amounts' : 'Hide amounts'}
          onPress={() => setHidden((h) => !h)}
          style={styles.eye}
          hitSlop={8}>
          <Feather name={hidden ? 'eye-off' : 'eye'} size={18} color={colors.ink} />
        </Pressable>
      </View>
      <Text style={styles.intro}>Only payments verified by the payment provider are proof. The rest is your own record.</Text>

      <View style={styles.months}>
        <Arrow icon="chevron-left" label="Previous month" disabled={month <= first} onPress={() => go(addMonths(month, -1))} />
        <Text style={styles.month}>{monthLabel(month)}</Text>
        <Arrow icon="chevron-right" label="Next month" disabled={month >= now} onPress={() => go(addMonths(month, 1))} />
      </View>

      {failed ? (
        <Card style={styles.center}>
          <Text style={styles.muted}>Couldn&apos;t load your record. Check your connection.</Text>
          <Button
            title="Try again"
            variant="secondary"
            onPress={() => {
              setFailed(false);
              setAttempt((a) => a + 1);
            }}
          />
        </Card>
      ) : !view ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <>
          {view.empty ? <Text style={styles.empty}>{view.empty}</Text> : null}
          {view.blocks.map((block) => {
            const opens = block.off ? null : OPENS[block.key];
            const card = (
              <Card style={styles.block}>
                {block.off ? <Text style={styles.muted}>{block.off}</Text> : null}
                {block.lines.map((line) => (
                  <Row key={line.label} line={line} onPress={line.evidence ? () => openOrders(line) : undefined} />
                ))}
                {opens ? (
                  <View style={styles.open}>
                    <Text style={styles.openText}>Open</Text>
                    <Feather name="chevron-right" size={15} color={colors.textMuted} />
                  </View>
                ) : null}
              </Card>
            );
            return (
              <View key={block.key} style={{ gap: 6 }}>
                <View style={styles.blockHead}>
                  <Overline>{block.title}</Overline>
                  {block.note ? <Text style={styles.blockNote}>{block.note}</Text> : null}
                </View>
                {opens ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Open ${block.title.toLowerCase()}`} onPress={() => router.push(opens)}>
                    {card}
                  </Pressable>
                ) : (
                  card
                )}
              </View>
            );
          })}
        </>
      )}
    </Screen>
  );
}

function Arrow({ icon, label, disabled, onPress }: { icon: 'chevron-left' | 'chevron-right'; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={styles.arrow} hitSlop={8}>
      <Feather name={icon} size={22} color={disabled ? colors.line : colors.ink} />
    </Pressable>
  );
}

/** A line of a block. Stock lines open their orders; the others are read inside their block's card. */
function Row({ line, onPress }: { line: RecordLine; onPress?: () => void }) {
  const said = `${line.label}, ${line.value === HIDDEN ? 'amount hidden' : line.value}${line.note ? `, ${line.note}` : ''}`;
  const inside = (
    <>
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, line.strong && styles.labelStrong]}>{line.label}</Text>
        {line.note ? <Text style={styles.note}>{line.note}</Text> : null}
      </View>
      <Text style={[styles.value, line.value === HIDDEN && styles.valueHidden]}>{line.value}</Text>
    </>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={said} onPress={onPress} style={styles.row}>
      {inside}
      <Feather name="chevron-right" size={16} color={colors.textMuted} />
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={said} style={styles.row}>
      {inside}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eye: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.iconTile },
  intro: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted },
  months: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.line },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  month: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.text },
  loading: { paddingVertical: 40, alignItems: 'center' },
  center: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  muted: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted },
  empty: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted, textAlign: 'center', paddingVertical: 4 },
  blockHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  blockNote: { fontFamily: fonts.medium, fontSize: 12, color: colors.textFaint },
  block: { gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  labelStrong: { fontFamily: fonts.bold },
  note: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 1 },
  value: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  valueHidden: { color: colors.textMuted, letterSpacing: 1 },
  open: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2, marginTop: -4 },
  openText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textMuted },
});
