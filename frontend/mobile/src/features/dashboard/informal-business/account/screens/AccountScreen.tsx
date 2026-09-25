import { Feather } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { ComponentProps, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { isVerified } from '@/features/auth/profile';
import { useSession } from '@/features/auth/session/SessionProvider';
import { IconTile } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Body, Overline, Title } from '@/shared/components/Text';
import { TopBar } from '@/shared/components/TopBar';
import { formatRand } from '@/shared/lib/money';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { Loaded, useToolSummaries } from '../../home/useToolSummaries';
import { AddToolSheet } from '../components/AddToolSheet';
import { accountSample } from '../mock';

type Tile = { icon: ComponentProps<typeof Feather>['name']; title: string; line: string; href?: Href; sample?: boolean; failed?: boolean };

/** A tile's line: the live value, or what's going on with it. */
function line<T>(loaded: Loaded<T>, ready: (d: T) => string): { line: string; failed?: boolean } {
  if (loaded.state === 'ready') return { line: ready(loaded.data) };
  if (loaded.state === 'failed') return { line: "Couldn't load · tap Account again", failed: true };
  return { line: '…' };
}

/** The tools the trader chose, each with a live line, plus this month's totals. */
export default function Account() {
  const { profile } = useSession();
  const { credit, jobs } = useToolSummaries();
  const [adding, setAdding] = useState(false);
  const t = profile.tools;
  const builder = profile.businessType === 'builder';

  const tiles: Tile[] = [
    ...(t.creditBook
      ? [{ icon: 'book', title: 'Credit book', href: '/informal-business/credit-book', ...line(credit, (d) => `${formatRand(d.customersOweCents)} owed to you`) } as Tile]
      : []),
    ...(t.orderStock ? [{ icon: 'package', title: builder ? 'Materials' : 'Order stock', line: `${accountSample.stockOnItsWay} on its way`, sample: true } as Tile] : []),
    ...(t.jobs ? [{ icon: 'tool', title: 'Jobs', href: '/informal-business/jobs', ...line(jobs, (d) => `${d.activeJobs} active`) } as Tile] : []),
    { icon: 'file-text', title: 'My orders', line: `${accountSample.ordersThisMonth} this month`, sample: true },
    { icon: 'shield', title: 'My record', line: `${accountSample.recordConfirmed} of ${accountSample.recordTotal} confirmed`, sample: true },
  ];
  const month = credit.state === 'ready' ? credit.data : null;

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
            {tile.sample ? <Text style={styles.sample}>sample</Text> : null}
          </Pressable>
        ))}
        <Pressable accessibilityRole="button" style={[styles.tile, styles.addTile]} onPress={() => setAdding(true)}>
          <IconTile name="plus" tint="#EFEBE4" />
          <Text style={styles.tileTitle}>Add a tool</Text>
          <Text style={styles.tileLine}>Jobs, Daily tally…</Text>
        </Pressable>
      </View>

      <Overline>This month</Overline>
      <View style={styles.month}>
        <Stat label="Stock bought" value={formatRand(accountSample.stockBought)} sample />
        <Stat label="Credit given" value={t.creditBook ? (month ? formatRand(month.givenThisMonthCents) : '…') : '—'} />
        <Stat label="Paid back" value={t.creditBook ? (month ? formatRand(month.paidBackThisMonthCents) : '…') : '—'} />
      </View>
      <Text style={styles.footnote}>&ldquo;Sample&rdquo; numbers come from orders and My record, which are still being built.</Text>

      {adding ? <AddToolSheet onClose={() => setAdding(false)} /> : null}
    </Screen>
  );
}

function Stat({ label, value, sample }: { label: string; value: string; sample?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>
        {label}
        {sample ? <Text style={styles.sampleInline}> · sample</Text> : null}
      </Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
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
  sample: { fontFamily: fonts.medium, fontSize: 11, color: colors.textFaint },
  sampleInline: { fontFamily: fonts.medium, fontSize: 10.5, color: colors.textFaint },
  month: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: colors.white, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, padding: 10 },
  statLabel: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted },
  statValue: { fontFamily: fonts.display, fontSize: 17, color: colors.ink, marginTop: 2 },
  footnote: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textFaint, textAlign: 'center' },
});
