import { Feather } from '@expo/vector-icons';
import { Href, router, useFocusEffect } from 'expo-router';
import { ComponentProps, useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { isVerified } from '@/features/auth/profile';
import { useSession } from '@/features/auth/session/SessionProvider';
import { ordersApi } from '@/features/dashboard/informal-business/orders/api/ordersApi';
import { IconTile } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Body, Title } from '@/shared/components/Text';
import { TopBar } from '@/shared/components/TopBar';
import { formatRand } from '@/shared/lib/money';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { Loaded, useToolSummaries } from '../../home/useToolSummaries';
import { AddToolSheet } from '../components/AddToolSheet';
import { OrderCounts, orderCounts } from '../lib/orderCounts';

type Tile = { icon: ComponentProps<typeof Feather>['name']; title: string; line: string; href?: Href; failed?: boolean };

/** A tile's line: the live value, or what's going on with it. */
function line<T>(loaded: Loaded<T>, ready: (d: T) => string): { line: string; failed?: boolean } {
  if (loaded.state === 'ready') return { line: ready(loaded.data) };
  if (loaded.state === 'failed') return { line: "Couldn't load · tap Account again", failed: true };
  return { line: '…' };
}

/** The tools the trader chose, each with a live line. The money records live in My record. */
export default function Account() {
  const { profile } = useSession();
  const { credit, jobs, orders } = useToolSummaries();
  const [mine, setMine] = useState<Loaded<OrderCounts>>({ state: 'loading' });
  const [adding, setAdding] = useState(false);
  const t = profile.tools;
  const builder = profile.businessType === 'builder';

  useFocusEffect(
    useCallback(() => {
      let live = true;
      ordersApi
        .list()
        .then((list) => live && setMine({ state: 'ready', data: orderCounts(list) }))
        .catch(() => live && setMine({ state: 'failed' }));
      return () => {
        live = false;
      };
    }, []),
  );

  const tiles: Tile[] = [
    ...(t.creditBook
      ? [{ icon: 'book', title: 'Credit book', href: '/informal-business/credit-book', ...line(credit, (d) => `${formatRand(d.customersOweCents)} owed to you`) } as Tile]
      : []),
    ...(t.orderStock
      ? [
          {
            icon: 'package',
            title: builder ? 'Materials' : 'Order stock',
            href: '/informal-business/suppliers',
            // Never a made-up number: if the orders can't be counted, just say what the tool does.
            line: mine.state === 'ready' ? `${mine.data.open} open` : mine.state === 'failed' ? 'Order from your suppliers' : '…',
          } as Tile,
        ]
      : []),
    ...(t.jobs ? [{ icon: 'tool', title: 'Jobs', href: '/informal-business/jobs', ...line(jobs, (d) => `${d.activeJobs} active`) } as Tile] : []),
    ...(t.orderBook
      ? [{ icon: 'clipboard', title: 'Order book', href: '/informal-business/order-book', ...line(orders, (d) => (d.ordersToday === 1 ? '1 order today' : `${d.ordersToday} orders today`)) } as Tile]
      : []),
    { icon: 'file-text', title: 'My orders', href: '/informal-business/orders', ...line(mine, (d) => `${d.thisMonth} this month`) },
    ...(t.myRecord ? [{ icon: 'shield', title: 'My record', line: 'Your money, kept apart', href: '/informal-business/record' } as Tile] : []),
  ];

  return (
    <Screen tab>
      <TopBar
        verified={isVerified(profile)}
        imageUrl={profile.profileImageUrl}
        onAvatarPress={() => router.push('/informal-business/business')}
        initial={profile.businessName[0] ?? 'K'}
        title="Account"
        subtitle={profile.businessName}
      />
      <View style={{ gap: 6 }}>
        <Title>Your tools</Title>
        <Body>Tap a tool to open it. Add the ones your business needs.</Body>
      </View>
      <View style={styles.grid}>
        {tiles.map((tile) => (
          <Pressable
            key={tile.title}
            accessibilityRole="button"
            accessibilityLabel={`${tile.title}, ${tile.line}`}
            style={styles.tile}
            onPress={() => tile.href && router.push(tile.href)}>
            <IconTile name={tile.icon} />
            <Text style={styles.tileTitle}>{tile.title}</Text>
            <Text style={[styles.tileLine, tile.failed && { color: colors.marigoldDeep }]}>{tile.line}</Text>
          </Pressable>
        ))}
        <Pressable accessibilityRole="button" style={[styles.tile, styles.addTile]} onPress={() => setAdding(true)}>
          <IconTile name="plus" tint="#EFEBE4" />
          <Text style={styles.tileTitle}>Add a tool</Text>
          <Text style={styles.tileLine}>Jobs, Daily tally…</Text>
        </Pressable>
      </View>

      {adding ? <AddToolSheet onClose={() => setAdding(false)} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    gap: 4,
  },
  addTile: { borderStyle: 'dashed', backgroundColor: 'transparent', flexGrow: 0 },
  tileTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text, marginTop: 8 },
  tileLine: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted },
});
