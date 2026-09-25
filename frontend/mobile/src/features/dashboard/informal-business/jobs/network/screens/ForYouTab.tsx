import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useSession } from '@/features/auth/session/SessionProvider';
import { ApiError } from '@/shared/api/client';
import { Button } from '@/shared/components/Button';
import { Card, IconTile, InfoNote, ListRow } from '@/shared/components/Parts';
import { Overline } from '@/shared/components/Text';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { networkApi } from '../api/networkApi';
import { ContactButtons } from '../components/ContactButtons';
import { HelpPostCard } from '../components/HelpPostCard';
import { PersonRow } from '../components/PersonRow';
import { ShowMeSheet } from '../components/ShowMeSheet';
import { SUGGESTION_WIDTH, SuggestionCard } from '../components/SuggestionCard';
import { helloText } from '../lib/contact';
import type { ForYou } from '../types';

const openBuilder = (id: string) => router.push({ pathname: '/informal-business/jobs/builders/[builderId]', params: { builderId: id } });
const openPost = (id: string) => router.push({ pathname: '/informal-business/jobs/help/[postId]', params: { postId: id } });

/**
 * For you: the builder network's front page (15_JOBS_BUILDER_NETWORK_PLAN.txt
 * §1). Who wants to connect, builders you may know (swipe), your help posts,
 * help wanted near you, your people with WhatsApp and Call, and suppliers
 * for your jobs (coming soon).
 */
export function ForYouTab() {
  const { profile } = useSession();
  const [data, setData] = useState<ForYou | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showMe, setShowMe] = useState(false);
  const at = profile.location ?? undefined;

  const load = useCallback(() => {
    let live = true;
    setFailed(false);
    networkApi
      .forYou(at)
      .then((d) => live && setData(d))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [at]);
  useFocusEffect(load);

  async function act(id: string, action: () => Promise<void>) {
    if (busy) return;
    setBusy(id);
    setError('');
    try {
      await action();
      setData(await networkApi.forYou(at));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PROFILE_HIDDEN') setShowMe(true);
      else setError(err instanceof ApiError ? err.message : "Couldn't do that. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  if (failed) {
    return (
      <Card style={styles.center}>
        <IconTile name="wifi-off" size={44} />
        <Text style={styles.muted}>Couldn&apos;t load builders. Check your connection and try again.</Text>
        <Button title="Try again" variant="secondary" onPress={load} />
      </Card>
    );
  }
  if (!data) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const me = profile.ownerName || profile.businessName;

  return (
    <>
      {data.visible ? (
        <Card style={{ paddingVertical: 4 }}>
          <ListRow icon="user-check" title="Your builder profile" subtitle="Other builders can find you and see the work you chose" onPress={() => router.push('/informal-business/jobs/my-profile')} last />
        </Card>
      ) : (
        <Card style={{ gap: 10 }}>
          <View style={styles.head}>
            <IconTile name="users" tint={colors.accentTint} color={colors.accentDeep} />
            <Text style={[styles.title, { flex: 1 }]}>Find builders to work with</Text>
          </View>
          <Text style={styles.body}>
            Plumbers, electricians, roofers near you, with photos of work their clients confirmed. Show yourself too, so they can find you.
          </Text>
          <Button title="Set up my builder profile" icon="user" onPress={() => router.push('/informal-business/jobs/my-profile')} />
        </Card>
      )}

      {error ? <InfoNote icon="alert-circle">{error}</InfoNote> : null}

      {data.requests.length ? (
        <View style={styles.section}>
          <Overline>Wants to connect</Overline>
          <Card style={{ paddingVertical: 0 }}>
            {data.requests.map((r, i) => (
              <PersonRow
                key={r.id}
                builder={r.from}
                line={r.from.reason}
                onOpen={() => openBuilder(r.from.id)}
                last={i === data.requests.length - 1}
                right={
                  <View style={styles.pair}>
                    <SmallButton label="Ignore" onPress={() => act(r.id, () => networkApi.ignore(r.id))} />
                    <SmallButton label="Accept" dark busy={busy === r.id} onPress={() => act(r.id, () => networkApi.accept(r.id))} />
                  </View>
                }
              />
            ))}
          </Card>
        </View>
      ) : null}

      {data.suggestions.length ? (
        <View style={styles.section}>
          <Overline>Builders you may know</Overline>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={SUGGESTION_WIDTH + 12}
            decelerationRate="fast"
            style={styles.bleed}
            contentContainerStyle={styles.swipe}>
            {data.suggestions.map((b) => (
              <SuggestionCard
                key={b.id}
                builder={b}
                busy={busy === b.id}
                onOpen={() => openBuilder(b.id)}
                onConnect={() => act(b.id, () => (b.connection === 'incoming' ? networkApi.accept(`req-${b.id}`) : networkApi.connect(b.id)))}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

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
          <Text style={styles.muted}>No one near you needs your trade right now. Posts show up here when they do.</Text>
        )}
      </View>

      {data.people.length ? (
        <View style={styles.section}>
          <Overline>Your people</Overline>
          <Card style={{ paddingVertical: 0 }}>
            {data.people.map((b, i) => (
              <PersonRow
                key={b.id}
                builder={b}
                onOpen={() => openBuilder(b.id)}
                last={i === data.people.length - 1}
                right={b.phone ? <ContactButtons compact name={b.name} phone={b.phone} message={helloText(b.name, me)} /> : null}
              />
            ))}
          </Card>
        </View>
      ) : null}

      <View style={styles.section}>
        <Overline>Suppliers for your jobs</Overline>
        <Card style={styles.soon}>
          <IconTile name="truck" />
          <View style={{ flex: 1 }}>
            <Text style={styles.soonTitle}>Coming soon</Text>
            <Text style={styles.soonText}>Suppliers that deliver the materials for each stage to your site.</Text>
          </View>
        </Card>
      </View>

      {showMe ? <ShowMeSheet onClose={() => setShowMe(false)} /> : null}
    </>
  );
}

function SmallButton({ label, dark, busy, onPress }: { label: string; dark?: boolean; busy?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={busy} hitSlop={4} style={[styles.small, dark && styles.smallDark]}>
      {busy ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={[styles.smallText, dark && { color: colors.white }]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: 40, alignItems: 'center' },
  center: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  muted: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted },
  section: { gap: 8 },
  bleed: { marginHorizontal: -20 },
  swipe: { paddingHorizontal: 20, gap: 12 },
  pair: { flexDirection: 'row', gap: 6 },
  small: { height: 36, minWidth: 64, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  smallDark: { backgroundColor: colors.ink, borderColor: colors.ink },
  smallText: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  soon: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  soonTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  soonText: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, color: colors.textMuted, marginTop: 2 },
});
