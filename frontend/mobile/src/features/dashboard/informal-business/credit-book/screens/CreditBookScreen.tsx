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
import { CreditTabs } from '../components/CreditTabs';
import { EntryRow, entryName } from '../components/EntryRow';
import { SummaryHeader } from '../components/SummaryHeader';
import { todayIso } from '../lib/dueDates';
import { CreditEntry, CreditKind } from '../types';

type Lists = Record<CreditKind, CreditEntry[]>;

/**
 * Credit book (PDF p2): who owes the trader, and who the trader owes.
 * Open entries first, soonest due on top (late ones first of all), then
 * what was paid back. After a save, the new entry is shown on top.
 */
export default function CreditBookScreen() {
  const params = useLocalSearchParams<{ tab?: string; saved?: string }>();
  const [kind, setKind] = useState<CreditKind>(params.tab === 'suppliers' ? 'supplier_debt' : 'customer_debt');
  const [lists, setLists] = useState<Lists | null>(null);
  const [failed, setFailed] = useState(false);
  const [today, setToday] = useState(todayIso());

  const load = useCallback(() => {
    let live = true;
    setFailed(false);
    setToday(todayIso());
    Promise.all([creditBookApi.list('customer_debt'), creditBookApi.list('supplier_debt'), creditBookApi.suppliersOwedFromOrders()])
      .then(([customers, suppliers, fromOrders]) => {
        if (live) setLists({ customer_debt: customers, supplier_debt: [...fromOrders, ...suppliers] });
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);
  useFocusEffect(load);

  const all = lists?.[kind] ?? [];
  const saved = all.find((e) => e.id === params.saved);
  const rest = all.filter((e) => e !== saved);
  const open = rest.filter((e) => e.status === 'open');
  const paid = rest.filter((e) => e.status === 'paid');
  const counted = all.filter((e) => e.status === 'open');
  const customers = kind === 'customer_debt';

  // The "Saved" note is for the moment you come back; once you move on, it goes.
  const forgetSaved = () => params.saved && router.setParams({ saved: '' });

  const openEntry = (e: CreditEntry) => {
    // Order debts belong to the order screens (Mandla's); only hand-added entries open here.
    if (e.source !== 'trader') return;
    forgetSaved();
    router.push({ pathname: '/informal-business/credit-book/[id]', params: { id: e.id } });
  };

  const switchTab = (k: CreditKind) => {
    forgetSaved();
    setKind(k);
  };

  return (
    <Screen
      back
      footer={
        customers ? (
          <Button title="Credit sale" icon="plus" onPress={() => router.push('/informal-business/credit-book/new')} />
        ) : (
          <Button title="Add supplier debt" icon="plus" onPress={() => router.push('/informal-business/credit-book/supplier-debt')} />
        )
      }>
      <Title>Credit book</Title>
      <CreditTabs value={kind} onChange={switchTab} />

      {failed ? (
        <Card style={styles.center}>
          <IconTile name="wifi-off" size={44} />
          <Text style={styles.muted}>Couldn&apos;t open your credit book. Check your connection and try again.</Text>
          <Button title="Try again" variant="secondary" onPress={load} />
        </Card>
      ) : !lists ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <>
          <SummaryHeader
            label={customers ? 'Total owed to you' : 'Total you owe'}
            totalCents={counted.reduce((s, e) => s + e.outstandingCents, 0)}
            dueToday={counted.filter((e) => e.dueOn === today).length}
            overdue={counted.filter((e) => e.dueOn < today).length}
          />

          {saved ? (
            <View style={{ gap: 8 }}>
              <InfoNote icon="check-circle" tone="ok">
                Saved. {customers ? `${entryName(saved)} owes you ${formatRand(saved.outstandingCents)}.` : `You owe ${entryName(saved)} ${formatRand(saved.outstandingCents)}.`}
              </InfoNote>
              <Card style={styles.group}>
                <EntryRow entry={saved} today={today} onPress={() => openEntry(saved)} last />
              </Card>
            </View>
          ) : null}

          {all.length === 0 ? (
            <Card style={styles.center}>
              <IconTile name={customers ? 'book-open' : 'truck'} size={44} />
              <Text style={styles.muted}>
                {customers
                  ? 'No one owes you anything yet. When someone takes goods now and pays later, add it here.'
                  : "You don't owe any suppliers. When a supplier gives you stock to pay later, add it here."}
              </Text>
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

          {customers ? <InfoNote icon="lock">Customer names stay private to you. Suppliers never see them.</InfoNote> : null}
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
