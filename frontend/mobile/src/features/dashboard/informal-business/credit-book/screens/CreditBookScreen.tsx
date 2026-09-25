import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { Card, IconTile, InfoNote } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Overline, Title } from '@/shared/components/Text';
import { formatRand } from '@/shared/lib/money';
import { colors, fonts } from '@/shared/theme/tokens';

import { creditBookApi } from '../api/creditBookApi';
import { EntryRow } from '../components/EntryRow';
import { SummaryHeader } from '../components/SummaryHeader';
import { todayIso } from '../lib/dueDates';
import { CreditEntry } from '../types';

/**
 * Credit book (PDF p2): customers who owe the trader. Open entries first,
 * soonest due on top (late ones first of all), then what was paid back.
 * After a save, the new entry is shown on top.
 */
export default function CreditBookScreen() {
  const params = useLocalSearchParams<{ saved?: string }>();
  const [entries, setEntries] = useState<CreditEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [today, setToday] = useState(todayIso());

  const load = useCallback(() => {
    let live = true;
    setFailed(false);
    setToday(todayIso());
    creditBookApi
      .list()
      .then((rows) => live && setEntries(rows))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);
  useFocusEffect(load);

  const all = entries ?? [];
  const saved = all.find((e) => e.id === params.saved);
  const rest = all.filter((e) => e !== saved);
  const open = rest.filter((e) => e.status === 'open');
  const paid = rest.filter((e) => e.status === 'paid');
  const counted = all.filter((e) => e.status === 'open');

  const openEntry = (e: CreditEntry) => {
    // The "Saved" note is for the moment you come back; once you move on, it goes.
    if (params.saved) router.setParams({ saved: '' });
    router.push({ pathname: '/informal-business/credit-book/[id]', params: { id: e.id } });
  };

  return (
    <Screen back footer={<Button title="Credit sale" icon="plus" onPress={() => router.push('/informal-business/credit-book/new')} />}>
      <Title>Credit book</Title>

      {failed ? (
        <Card style={styles.center}>
          <IconTile name="wifi-off" size={44} />
          <Text style={styles.muted}>Couldn&apos;t open your credit book. Check your connection and try again.</Text>
          <Button title="Try again" variant="secondary" onPress={load} />
        </Card>
      ) : !entries ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <>
          <SummaryHeader
            label="Total owed to you"
            totalCents={counted.reduce((s, e) => s + e.outstandingCents, 0)}
            dueToday={counted.filter((e) => e.dueOn === today).length}
            overdue={counted.filter((e) => e.dueOn < today).length}
          />

          {saved ? (
            <View style={{ gap: 8 }}>
              <InfoNote icon="check-circle" tone="ok">
                Saved. {saved.customer.name} owes you {formatRand(saved.outstandingCents)}.
              </InfoNote>
              <Card style={styles.group}>
                <EntryRow entry={saved} today={today} onPress={() => openEntry(saved)} last />
              </Card>
            </View>
          ) : null}

          {all.length === 0 ? (
            <Card style={styles.center}>
              <IconTile name="book-open" size={44} />
              <Text style={styles.muted}>No one owes you anything yet. When someone takes goods now and pays later, add it here.</Text>
            </Card>
          ) : null}

          {open.length ? (
            <Card style={styles.group}>
              {open.map((e, i) => (
                <EntryRow key={e.id} entry={e} today={today} onPress={() => openEntry(e)} last={i === open.length - 1} />
              ))}
            </Card>
          ) : null}

          {paid.length ? (
            <>
              <Overline>Paid back</Overline>
              <Card style={styles.group}>
                {paid.map((e, i) => (
                  <EntryRow key={e.id} entry={e} today={today} onPress={() => openEntry(e)} last={i === paid.length - 1} />
                ))}
              </Card>
            </>
          ) : null}

          <InfoNote icon="lock">Customer names stay private to you. Suppliers never see them.</InfoNote>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: 40, alignItems: 'center' },
  center: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  muted: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted, textAlign: 'center' },
  group: { paddingVertical: 0 },
});
