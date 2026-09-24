import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { Card, IconTile, Tag } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Overline } from '@/shared/components/Text';
import { TopBar } from '@/shared/components/TopBar';
import { formatRand } from '@/shared/lib/money';
import { builderHome, builderToday, spazaHome, spazaToday, TodayItem } from '../mock';
import { areaOf, isVerified } from '@/features/auth/profile';
import { useSession } from '@/features/auth/session/SessionProvider';
import { colors, fonts, radius } from '@/shared/theme/tokens';

const TINTS = {
  marigold: { bg: colors.marigoldTint, fg: colors.marigoldDeep },
  info: { bg: colors.iconTile, fg: colors.ink },
  jade: { bg: colors.jadeTint, fg: colors.jade },
};

/** The number that matters most, two quick actions, then only what needs attention today. */
export default function Home() {
  const { profile } = useSession();
  const builder = profile.businessType === 'builder';
  const today = builder ? builderToday : spazaToday;
  const kind = builder ? 'Builder · ' : '';

  return (
    <Screen tab>
      <TopBar
        verified={isVerified(profile)}
        onAvatarPress={() => router.push('/informal-business/business')}
        initial={profile.businessName[0] ?? 'K'}
        title={profile.businessName}
        subtitle={`${kind}${areaOf(profile)}`}
        action={{ icon: 'bell', label: 'Notifications', dot: true, onPress: () => router.push('/informal-business/notifications') }}
      />

      <LinearGradient colors={['#1E293B', colors.ink]} style={styles.hero}>
        {builder ? (
          <>
            <Text style={styles.heroLabel}>Waiting on clients</Text>
            <Text style={styles.heroMoney}>{formatRand(builderHome.waitingOnClients)}</Text>
            <Text style={styles.heroNote}>
              Walls stage · <Text style={styles.heroNoteHot}>needs sign-off</Text>
            </Text>
            <View style={styles.heroRow}>
              <Mini label="Active jobs" value={String(builderHome.activeJobs)} />
              <Mini label="You owe hardware" value={formatRand(builderHome.youOweHardware)} />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.heroLabel}>Customers owe you</Text>
            <Text style={styles.heroMoney}>{formatRand(spazaHome.customersOweYou)}</Text>
            <Text style={styles.heroNote}>
              {spazaHome.customersCount} customers ·{' '}
              <Text style={styles.heroNoteHot}>{formatRand(spazaHome.dueToday)} due today</Text>
            </Text>
            <View style={styles.heroRow}>
              <Mini label="You owe suppliers" value={formatRand(spazaHome.youOweSuppliers)} />
              <Mini label="Cash in today" value={formatRand(spazaHome.cashInToday)} />
            </View>
          </>
        )}
      </LinearGradient>

      <View style={styles.actions}>
        <Button
          compact
          icon="plus"
          title={builder ? 'New job' : 'Credit sale'}
          onPress={() => router.push(builder ? '/informal-business/jobs' : '/informal-business/credit-book')}
        />
        <Button compact icon="shopping-cart" title={builder ? 'Materials' : 'Order stock'} onPress={() => router.push('/informal-business/suppliers')} />
      </View>

      <Overline>Today</Overline>
      <View style={{ gap: 10 }}>
        {today.map((item) => (
          <TodayCard key={item.id} item={item} />
        ))}
      </View>
      <Text style={styles.sample}>Sample data · real numbers arrive as each tool is connected</Text>
    </Screen>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.mini}>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={styles.miniValue}>{value}</Text>
    </View>
  );
}

function TodayCard({ item }: { item: TodayItem }) {
  const tint = TINTS[item.tint];
  return (
    <Card onPress={() => {}}>
      <View style={styles.itemRow}>
        <IconTile name={item.icon} tint={tint.bg} color={tint.fg} />
        <View style={{ flex: 1 }}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          <Text style={styles.itemSub}>{item.subtitle}</Text>
        </View>
        {item.amount !== undefined ? <Text style={styles.itemAmount}>{formatRand(item.amount)}</Text> : null}
        {item.tag && item.amount === undefined ? <Tag label={item.tag.label} tone={item.tag.tone} /> : null}
        <Feather name="chevron-right" size={17} color={colors.textFaint} />
      </View>
      {item.tag && item.amount !== undefined ? (
        <View style={styles.itemFoot}>
          <Tag label={item.tag.label} tone={item.tag.tone} />
          <View style={styles.pass}>
            <Text style={styles.passText}>Show order pass</Text>
            <Feather name="maximize" size={14} color={colors.ink} />
          </View>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.lg, padding: 18, gap: 2 },
  heroLabel: { fontFamily: fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  heroMoney: { fontFamily: fonts.display, fontSize: 44, lineHeight: 52, color: colors.white },
  heroNote: { fontFamily: fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  heroNoteHot: { fontFamily: fonts.bold, color: colors.marigold },
  heroRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  mini: { flex: 1, backgroundColor: 'rgba(255,255,255,0.09)', borderRadius: radius.sm, padding: 10 },
  miniLabel: { fontFamily: fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  miniValue: { fontFamily: fonts.display, fontSize: 18, color: colors.white, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  itemSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  itemAmount: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  itemFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    borderStyle: 'dashed',
  },
  pass: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  passText: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  sample: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textFaint, textAlign: 'center' },
});
