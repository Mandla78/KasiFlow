import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { areaOf, isVerified } from '@/features/auth/profile';
import { useSession } from '@/features/auth/session/SessionProvider';
import { creditBookApi } from '@/features/dashboard/informal-business/credit-book/api/creditBookApi';
import { todayIso } from '@/features/dashboard/informal-business/credit-book/lib/dueDates';
import { jobsApi } from '@/features/dashboard/informal-business/jobs/api/jobsApi';
import { Button } from '@/shared/components/Button';
import { Card, IconTile, Tag } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Overline } from '@/shared/components/Text';
import { TopBar } from '@/shared/components/TopBar';
import { formatRand } from '@/shared/lib/money';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { useUnreadCount } from '../../notifications/lib/notificationStore';
import { creditToday, jobsToday, TodayItem } from '../lib/today';
import { builderSample, builderSampleToday, spazaSample, spazaSampleToday } from '../mock';
import { Loaded, useToolSummaries } from '../useToolSummaries';

const TINTS = {
  marigold: { bg: colors.marigoldTint, fg: colors.marigoldDeep },
  info: { bg: colors.iconTile, fg: colors.ink },
  jade: { bg: colors.jadeTint, fg: colors.jade },
};

/** A number that is still loading, failed, or ready. */
function shown<T>(loaded: Loaded<T>, pick: (d: T) => string): string {
  if (loaded.state === 'ready') return pick(loaded.data);
  return loaded.state === 'loading' ? '…' : '—';
}

/**
 * The number that matters most, two quick actions, then only what needs
 * attention today. Spaza: what customers owe (credit book). Builder: what's
 * waiting on clients (jobs). Numbers that come from orders stay marked
 * "Sample" until the orders side exists.
 */
export default function Home() {
  const { profile } = useSession();
  const unread = useUnreadCount();
  const builder = profile.businessType === 'builder';
  const { credit, jobs, reload } = useToolSummaries();
  const [today, setToday] = useState<TodayItem[] | null>(null);
  const [todayFailed, setTodayFailed] = useState(false);
  const kind = builder ? 'Builder · ' : '';
  const creditOn = profile.tools.creditBook;
  const jobsOn = profile.tools.jobs;

  const loadToday = useCallback(() => {
    let live = true;
    setTodayFailed(false);
    const mine: Promise<TodayItem[]> = builder
      ? jobsOn
        ? jobsApi.list().then(jobsToday)
        : Promise.resolve([])
      : creditOn
        ? creditBookApi.list().then((entries) => creditToday(entries, todayIso()))
        : Promise.resolve([]);
    mine.then((items) => live && setToday(items)).catch(() => live && setTodayFailed(true));
    return () => {
      live = false;
    };
  }, [builder, creditOn, jobsOn]);
  useFocusEffect(loadToday);

  const failed = (builder ? jobs : credit).state === 'failed';
  const samples = builder ? builderSampleToday : spazaSampleToday;

  return (
    <Screen tab>
      <TopBar
        verified={isVerified(profile)}
        imageUrl={profile.profileImageUrl}
        onAvatarPress={() => router.push('/informal-business/business')}
        initial={profile.businessName[0] ?? 'K'}
        title={profile.businessName}
        subtitle={`${kind}${areaOf(profile)}`}
        action={{ icon: 'bell', label: 'Notifications', dot: unread > 0, onPress: () => router.push('/informal-business/notifications') }}
      />

      <LinearGradient colors={['#1E293B', colors.ink]} style={styles.hero}>
        {builder ? (
          <>
            <Text style={styles.heroLabel}>Waiting on clients</Text>
            <Text style={styles.heroMoney}>{jobsOn ? shown(jobs, (d) => formatRand(d.waitingOnClientsCents)) : '—'}</Text>
            <Text style={styles.heroNote}>
              {!jobsOn ? (
                'Switch on Jobs in Account'
              ) : jobs.state === 'ready' && jobs.data.needsSignOff > 0 ? (
                <Text style={styles.heroNoteHot}>
                  {jobs.data.needsSignOff === 1 ? '1 stage needs' : `${jobs.data.needsSignOff} stages need`} your sign-off
                </Text>
              ) : jobs.state === 'ready' ? (
                'No stages waiting on you'
              ) : (
                ' '
              )}
            </Text>
            <View style={styles.heroRow}>
              <Mini label="Active jobs" value={jobsOn ? shown(jobs, (d) => String(d.activeJobs)) : '—'} />
              <Mini label="You owe hardware" value={formatRand(builderSample.youOweHardware)} sample />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.heroLabel}>Customers owe you</Text>
            <Text style={styles.heroMoney}>{creditOn ? shown(credit, (d) => formatRand(d.customersOweCents)) : '—'}</Text>
            <Text style={styles.heroNote}>
              {!creditOn ? (
                'Switch on the credit book in Account'
              ) : credit.state === 'ready' ? (
                <>
                  {credit.data.customersOwing === 1 ? '1 customer' : `${credit.data.customersOwing} customers`} ·{' '}
                  <Text style={styles.heroNoteHot}>
                    {credit.data.dueTodayCount ? `${formatRand(credit.data.dueTodayCents)} due today` : 'nothing due today'}
                  </Text>
                </>
              ) : (
                ' '
              )}
            </Text>
            <View style={styles.heroRow}>
              <Mini label="You owe suppliers" value={formatRand(spazaSample.youOweSuppliers)} sample />
              <Mini label="Cash in today" value={formatRand(spazaSample.cashInToday)} sample />
            </View>
          </>
        )}
        {failed ? (
          <Pressable accessibilityRole="button" onPress={reload} style={styles.retry}>
            <Text style={styles.retryText}>Couldn&apos;t load your numbers. Tap to try again.</Text>
          </Pressable>
        ) : null}
      </LinearGradient>

      <View style={styles.actions}>
        <Button
          compact
          icon="plus"
          title={builder ? 'New job' : 'Credit sale'}
          onPress={() => router.push(builder ? '/informal-business/jobs/new' : '/informal-business/credit-book/new')}
        />
        <Button compact icon="shopping-cart" title={builder ? 'Materials' : 'Order stock'} onPress={() => router.push('/informal-business/suppliers')} />
      </View>

      <Overline>Today</Overline>
      <View style={{ gap: 10 }}>
        {todayFailed ? (
          <Card onPress={loadToday}>
            <Text style={styles.muted}>Couldn&apos;t load today&apos;s list. Tap to try again.</Text>
          </Card>
        ) : today && today.length === 0 ? (
          <Card>
            <Text style={styles.muted}>{builder ? 'No stages need you today.' : 'Nobody is due to pay today.'}</Text>
          </Card>
        ) : null}
        {(today ?? []).map((item) => (
          <TodayCard key={item.id} item={item} />
        ))}
        {samples.map((item) => (
          <TodayCard key={item.id} item={item} />
        ))}
      </View>
      <Text style={styles.sample}>&ldquo;Sample&rdquo; numbers come from orders, which are still being built.</Text>
    </Screen>
  );
}

function Mini({ label, value, sample }: { label: string; value: string; sample?: boolean }) {
  return (
    <View style={styles.mini}>
      <Text style={styles.miniLabel}>
        {label}
        {sample ? <Text style={styles.miniSample}> · sample</Text> : null}
      </Text>
      <Text style={styles.miniValue}>{value}</Text>
    </View>
  );
}

function TodayCard({ item }: { item: TodayItem }) {
  const tint = TINTS[item.tint];
  return (
    <Card onPress={item.href ? () => router.push(item.href!) : undefined}>
      <View style={styles.itemRow}>
        <IconTile name={item.icon} tint={tint.bg} color={tint.fg} />
        <View style={{ flex: 1 }}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          <Text style={styles.itemSub}>{item.subtitle}</Text>
        </View>
        {item.amount !== undefined ? <Text style={styles.itemAmount}>{formatRand(item.amount)}</Text> : null}
        {item.tag && item.amount === undefined ? <Tag label={item.tag.label} tone={item.tag.tone} /> : null}
        {item.href ? <Feather name="chevron-right" size={17} color={colors.textFaint} /> : null}
      </View>
      {item.tag && item.amount !== undefined ? (
        <View style={styles.itemFoot}>
          <Tag label={item.tag.label} tone={item.tag.tone} />
          {item.sample ? <Tag label="Sample" tone="muted" /> : null}
        </View>
      ) : item.sample ? (
        <View style={styles.itemFoot}>
          <Tag label="Sample" tone="muted" />
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
  miniSample: { fontFamily: fonts.medium, fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  miniValue: { fontFamily: fonts.display, fontSize: 18, color: colors.white, marginTop: 2 },
  retry: { marginTop: 10, minHeight: 44, justifyContent: 'center' },
  retryText: { fontFamily: fonts.bold, fontSize: 13, color: colors.marigold },
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
  muted: { fontFamily: fonts.body, fontSize: 13.5, color: colors.textMuted },
  sample: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textFaint, textAlign: 'center' },
});
