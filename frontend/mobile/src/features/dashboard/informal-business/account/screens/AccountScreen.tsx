import { Feather } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconTile } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Body, Overline, Title } from '@/shared/components/Text';
import { TopBar } from '@/shared/components/TopBar';
import { formatRand } from '@/shared/lib/money';
import { accountMonth, toolLines } from '../mock';
import { useSession } from '@/features/auth/session/SessionProvider';
import { colors, fonts, radius } from '@/shared/theme/tokens';

type Tile = { icon: ComponentProps<typeof Feather>['name']; title: string; line: string; href?: Href };

/** The tools the trader chose, each with a live line, plus this month's totals. */
export default function Account() {
  const { profile } = useSession();
  const t = profile.tools;
  const builder = profile.businessType === 'builder';

  const tiles: Tile[] = [
    ...(t.creditBook ? [{ icon: 'book', title: 'Credit book', line: `${formatRand(toolLines.owedToYou)} owed to you`, href: '/informal-business/credit-book' } as Tile] : []),
    ...(t.orderStock ? [{ icon: 'package', title: builder ? 'Materials' : 'Order stock', line: `${toolLines.stockOnItsWay} on its way` } as Tile] : []),
    ...(t.jobs ? [{ icon: 'tool', title: 'Jobs', line: `${toolLines.activeJobs} active`, href: '/informal-business/jobs' } as Tile] : []),
    { icon: 'file-text', title: 'My orders', line: `${toolLines.ordersThisMonth} this month` },
    { icon: 'shield', title: 'My record', line: `${toolLines.recordConfirmed} of ${toolLines.recordTotal} confirmed` },
  ];

  return (
    <Screen tab>
      <TopBar initial={profile.businessName[0] ?? 'K'} title="Account" subtitle={profile.businessName} />
      <View style={{ gap: 6 }}>
        <Title>Your tools</Title>
        <Body>Tap a tool to open it. Add the ones your business needs.</Body>
      </View>
      <View style={styles.grid}>
        {tiles.map((tile) => (
          <Pressable key={tile.title} style={styles.tile} onPress={() => tile.href && router.push(tile.href)}>
            <IconTile name={tile.icon} />
            <Text style={styles.tileTitle}>{tile.title}</Text>
            <Text style={styles.tileLine}>{tile.line}</Text>
          </Pressable>
        ))}
        <Pressable style={[styles.tile, styles.addTile]}>
          <IconTile name="plus" tint="#EFEBE4" />
          <Text style={styles.tileTitle}>Add a tool</Text>
          <Text style={styles.tileLine}>Jobs, Daily tally…</Text>
        </Pressable>
      </View>

      <Overline>This month</Overline>
      <View style={styles.month}>
        <Stat label="Stock bought" value={accountMonth.stockBought} />
        <Stat label="Credit given" value={accountMonth.creditGiven} />
        <Stat label="Paid back" value={accountMonth.paidBack} />
      </View>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{formatRand(value)}</Text>
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
  month: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: colors.white, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, padding: 10 },
  statLabel: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted },
  statValue: { fontFamily: fonts.display, fontSize: 17, color: colors.ink, marginTop: 2 },
});
