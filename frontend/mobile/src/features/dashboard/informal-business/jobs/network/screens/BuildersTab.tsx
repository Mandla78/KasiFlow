import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useSession } from '@/features/auth/session/SessionProvider';
import { Button } from '@/shared/components/Button';
import { Card, IconTile, ListRow } from '@/shared/components/Parts';
import { Overline } from '@/shared/components/Text';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { networkApi } from '../api/networkApi';
import { BuilderRow } from '../components/BuilderRow';
import { ContactButtons } from '../components/ContactButtons';
import { HelpPostCard } from '../components/HelpPostCard';
import { helloText } from '../lib/contact';
import { TRADES, type Trade } from '../lib/trades';
import type { BuildersHome } from '../types';

const openBuilder = (id: string) => router.push({ pathname: '/informal-business/jobs/builders/[builderId]', params: { builderId: id } });
const openPost = (id: string) => router.push({ pathname: '/informal-business/jobs/help/[postId]', params: { postId: id } });

/**
 * Builders: find people to bring onto your jobs, by what they've built.
 * Your partners (people you've worked a job with) with WhatsApp and Call,
 * builders you saved, builders near you by trade, and help wanted near
 * you (each with its pay). No "connect": partners come from working a job
 * together (DECISION_jobs_partners.txt).
 */
export function BuildersTab() {
  const { profile } = useSession();
  const [trade, setTrade] = useState<Trade | null>(null);
  const [data, setData] = useState<BuildersHome | null>(null);
  const [failed, setFailed] = useState(false);
  const at = profile.location ?? undefined;
  const me = profile.ownerName || profile.businessName;

  const load = useCallback(() => {
    let live = true;
    setFailed(false);
    networkApi
      .builders({ trade }, at)
      .then((d) => live && setData(d))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [trade, at]);
  useFocusEffect(load);

  if (failed) {
    return (
      <Card style={styles.center}>
        <IconTile name="wifi-off" size={44} />
        <Text style={styles.muted}>Couldn&apos;t load builders. Check your connection and try again.</Text>
        <Button title="Try again" variant="secondary" onPress={load} />
      </Card>
    );
  }

  return (
    <>
      {data && !data.visible ? (
        <Card style={{ gap: 10 }}>
          <View style={styles.head}>
            <IconTile name="image" tint={colors.accentTint} color={colors.accentDeep} />
            <Text style={[styles.title, { flex: 1 }]}>Show your builds</Text>
          </View>
          <Text style={styles.body}>Builders near you pick partners by the work their clients confirmed. Show yours, so they can invite you onto their jobs.</Text>
          <Button title="Set up my builder profile" icon="user" onPress={() => router.push('/informal-business/jobs/my-profile')} />
        </Card>
      ) : data ? (
        <Card style={{ paddingVertical: 4 }}>
          <ListRow icon="user-check" title="Your builder profile" subtitle="Your builds, trades and how far you travel" onPress={() => router.push('/informal-business/jobs/my-profile')} last />
        </Card>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.chips}>
        {[{ key: null, label: 'All trades' }, ...TRADES].map((t) => {
          const on = trade === t.key;
          return (
            <Pressable key={t.label} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setTrade(t.key)} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {!data ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <>
          {data.partners.length && !trade ? (
            <View style={styles.section}>
              <Overline>Your partners</Overline>
              <Card style={{ paddingVertical: 0 }}>
                {data.partners.map((b, i) => (
                  <BuilderRow
                    key={b.id}
                    builder={b}
                    onOpen={() => openBuilder(b.id)}
                    last={i === data.partners.length - 1}
                    right={b.phone ? <ContactButtons compact name={b.name} phone={b.phone} message={helloText(b.name, me)} /> : undefined}
                  />
                ))}
              </Card>
            </View>
          ) : null}

          {data.saved.length && !trade ? (
            <View style={styles.section}>
              <Overline>Saved</Overline>
              <Card style={{ paddingVertical: 0 }}>
                {data.saved.map((b, i) => (
                  <BuilderRow key={b.id} builder={b} onOpen={() => openBuilder(b.id)} last={i === data.saved.length - 1} />
                ))}
              </Card>
            </View>
          ) : null}

          <View style={styles.section}>
            <Overline>{trade ? `${TRADES.find((t) => t.key === trade)?.label}s near you` : 'Builders near you'}</Overline>
            {data.nearby.length ? (
              <Card style={{ paddingVertical: 0 }}>
                {data.nearby.map((b, i) => (
                  <BuilderRow key={b.id} builder={b} onOpen={() => openBuilder(b.id)} last={i === data.nearby.length - 1} />
                ))}
              </Card>
            ) : (
              <Text style={styles.muted}>No one of that trade near you yet. New builders are joining; check again soon.</Text>
            )}
            <Text style={styles.small}>Within {data.travelKm} km of you. Change it in your builder profile.</Text>
          </View>

          {data.myPosts.length ? (
            <View style={styles.section}>
              <Overline>Your help posts</Overline>
              {data.myPosts.map((p) => (
                <HelpPostCard key={p.id} post={p} onPress={() => openPost(p.id)} />
              ))}
            </View>
          ) : null}

          <View style={styles.section}>
            <Overline>Help wanted near you</Overline>
            {data.helpWanted.length ? (
              data.helpWanted.slice(0, 5).map((p) => <HelpPostCard key={p.id} post={p} onPress={() => openPost(p.id)} />)
            ) : (
              <Text style={styles.muted}>No one near you needs your trade right now. Posts show up here, with the pay, when they do.</Text>
            )}
          </View>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: 40, alignItems: 'center' },
  center: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  muted: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted },
  small: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, color: colors.textMuted },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted },
  section: { gap: 8 },
  bleed: { marginHorizontal: -20 },
  chips: { paddingHorizontal: 20, gap: 8 },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  chipTextOn: { color: colors.white },
});
