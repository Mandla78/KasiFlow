import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { Card, IconTile, InfoNote } from '@/shared/components/Parts';
import { BackButton, Screen } from '@/shared/components/Screen';
import { Title } from '@/shared/components/Text';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { Tabs } from '@/shared/components/Tabs';
import { forgetRefused, open, useCounter } from '../lib/counterStore';
import { NewOrderTab } from './NewOrderTab';
import { QueueTab } from './QueueTab';
import { TodayTab } from './TodayTab';

type Tab = 'new' | 'queue' | 'today';

/** Every 20 seconds while open: the other phone's orders, and anything waiting to send. */
const REFRESH_MS = 20_000;

/**
 * The order book (14_ROUND_2_BRIEF.txt §2): [ New order | Queue | Today ],
 * the menu one tap away. Works without signal: orders are kept on the
 * phone and sent when it's back (the banner says so).
 */
export default function OrderBookScreen() {
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const tab: Tab = params.tab ?? 'new';
  const setTab = (t: Tab) => router.setParams({ tab: t });
  const { menu, orders, waiting, offline, loading, failed, refused } = useCounter();
  const queue = orders.filter((o) => o.status === 'new' || o.status === 'preparing' || o.status === 'ready').length;

  useFocusEffect(
    useCallback(() => {
      void open();
      const t = setInterval(() => void open(), REFRESH_MS);
      return () => clearInterval(t);
    }, []),
  );

  return (
    <Screen>
      <View style={styles.bar}>
        <BackButton />
        <Pressable accessibilityRole="button" accessibilityLabel="Menu: items and prices" onPress={() => router.push('/informal-business/order-book/menu')} style={styles.menu}>
          <Feather name="list" size={18} color={colors.ink} />
          <Text style={styles.menuText}>Menu</Text>
        </Pressable>
      </View>
      <Title>Order book</Title>

      {offline ? (
        <View style={styles.offline}>
          <Feather name="cloud-off" size={16} color={colors.marigoldDeep} />
          <Text style={styles.offlineText}>
            No signal. {waiting ? `${waiting} change${waiting === 1 ? '' : 's'} kept on this phone` : 'New orders are kept on this phone'}; they go when you&apos;re back online.
          </Text>
        </View>
      ) : null}
      {refused ? (
        <Pressable accessibilityRole="button" onPress={forgetRefused}>
          <InfoNote icon="alert-circle">{refused} (tap to close)</InfoNote>
        </Pressable>
      ) : null}

      <Tabs
        tabs={[
          { key: 'new', label: 'New order' },
          { key: 'queue', label: 'Queue', badge: queue },
          { key: 'today', label: 'Today' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {failed && !menu ? (
        <Card style={styles.center}>
          <IconTile name="alert-circle" size={44} />
          <Text style={styles.muted}>Couldn&apos;t open the order book.</Text>
          <Button title="Try again" variant="secondary" onPress={() => void open()} />
        </Card>
      ) : !menu ? (
        <View style={styles.loading}>{loading ? <ActivityIndicator color={colors.accent} /> : <Text style={styles.muted}>Waiting for a signal to load your menu…</Text>}</View>
      ) : tab === 'queue' ? (
        <QueueTab />
      ) : tab === 'today' ? (
        <TodayTab />
      ) : (
        <NewOrderTab />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  menu: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 14, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  menuText: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  offline: { flexDirection: 'row', gap: 10, backgroundColor: colors.marigoldTint, borderRadius: radius.sm, padding: 12 },
  offlineText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: colors.marigoldDeep },
  center: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  loading: { paddingVertical: 40, alignItems: 'center' },
  muted: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted, textAlign: 'center' },
});
