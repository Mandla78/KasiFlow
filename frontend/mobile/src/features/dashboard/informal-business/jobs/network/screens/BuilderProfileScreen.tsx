import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useSession } from '@/features/auth/session/SessionProvider';
import { SupplierAvatar } from '@/features/dashboard/informal-business/suppliers/components/SupplierAvatar';
import { ApiError } from '@/shared/api/client';
import { Button } from '@/shared/components/Button';
import { Card, IconTile, InfoNote } from '@/shared/components/Parts';
import { BackButton, Screen } from '@/shared/components/Screen';
import { Overline, Title } from '@/shared/components/Text';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { networkApi } from '../api/networkApi';
import { ContactButtons } from '../components/ContactButtons';
import { ReportBlockSheet } from '../components/ReportBlockSheet';
import { ShowMeSheet } from '../components/ShowMeSheet';
import { WorkSlideshow } from '../components/WorkSlideshow';
import { helloText } from '../lib/contact';
import { kmText } from '../lib/recommend';
import { tradesText } from '../lib/trades';
import type { BuilderProfile } from '../types';

function since(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
}

/**
 * Another builder: who they are, proof from their clients, and their work
 * as a slideshow. Connect first; WhatsApp and Call once you're connected.
 * "..." reports or blocks. Never their clients, never an address.
 */
export default function BuilderProfileScreen() {
  const { builderId } = useLocalSearchParams<{ builderId: string }>();
  const { profile: mine } = useSession();
  const [b, setB] = useState<BuilderProfile | null>(null);
  const [failure, setFailure] = useState<'missing' | 'network' | null>(null);
  const [slide, setSlide] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  const [showMe, setShowMe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  const at = mine.location ?? undefined;
  // Two square photos a row, inside the screen's 20 px sides and a 10 px gap.
  const tile = Math.floor((Math.min(useWindowDimensions().width, 600) - 40 - 10) / 2);

  const load = useCallback(() => {
    let live = true;
    setFailure(null);
    networkApi
      .builder(builderId ?? '', at)
      .then((p) => live && setB(p))
      .catch((e) => live && setFailure(e instanceof ApiError && e.status === 404 ? 'missing' : 'network'));
    return () => {
      live = false;
    };
  }, [builderId, at]);
  useFocusEffect(load);

  async function connect(profile: BuilderProfile) {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      if (profile.connection === 'incoming') await networkApi.accept(`req-${profile.id}`);
      else await networkApi.connect(profile.id);
      setB(await networkApi.builder(profile.id, at));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PROFILE_HIDDEN') setShowMe(true);
      else setNote({ text: err instanceof ApiError ? err.message : "Couldn't send it. Check your connection and try again.", ok: false });
    } finally {
      setBusy(false);
    }
  }

  if (failure || !b) {
    return (
      <Screen back>
        {failure ? (
          <Card style={styles.center}>
            <IconTile name={failure === 'missing' ? 'search' : 'wifi-off'} size={44} />
            <Text style={styles.muted}>{failure === 'missing' ? "We couldn't find that builder." : "Couldn't open this builder. Check your connection and try again."}</Text>
            {failure === 'network' ? <Button title="Try again" variant="secondary" onPress={load} /> : null}
          </Card>
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}
      </Screen>
    );
  }

  const first = b.name.split(' ')[0];

  return (
    <Screen>
      <View style={styles.bar}>
        <BackButton />
        <Pressable accessibilityRole="button" accessibilityLabel={`More about ${b.name}: report or block`} hitSlop={8} onPress={() => setMenu(true)} style={styles.more}>
          <Feather name="more-horizontal" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <View style={styles.who}>
        <SupplierAvatar name={b.name} initials={b.initials} color={b.color} logoUrl={b.photoUrl} size={84} />
        <Title style={{ textAlign: 'center' }}>{b.name}</Title>
        <Text style={styles.trades}>{tradesText(b.trades)}</Text>
        <Text style={styles.muted}>
          {b.suburb} · {kmText(b.distanceKm)} · on Akayza since {since(b.onAkayzaSince)}
        </Text>
        {b.about ? <Text style={styles.about}>“{b.about}”</Text> : null}
      </View>

      <View style={styles.proof}>
        <Proof value={b.confirmedStages} label={b.confirmedStages === 1 ? 'stage confirmed by a client' : 'stages confirmed by clients'} />
        <Proof value={b.jobsDone} label={b.jobsDone === 1 ? 'job done' : 'jobs done'} />
        <Proof value={b.mutual.length} label={b.mutual.length === 1 ? 'builder you both know' : 'builders you both know'} />
      </View>

      {b.connection === 'connected' && b.phone ? (
        <ContactButtons name={b.name} phone={b.phone} message={helloText(b.name, mine.ownerName || mine.businessName)} />
      ) : (
        <View style={{ gap: 8 }}>
          <Button
            title={b.connection === 'requested' ? `Requested. Waiting for ${first}` : b.connection === 'incoming' ? `Accept ${first}` : `Connect with ${first}`}
            icon={b.connection === 'requested' ? 'clock' : 'user-plus'}
            disabled={b.connection === 'requested'}
            loading={busy}
            onPress={() => connect(b)}
          />
          <Text style={styles.small}>Numbers are shared only once you both say yes. Then you can WhatsApp or call.</Text>
        </View>
      )}

      {note ? (
        <InfoNote icon={note.ok ? 'check-circle' : 'alert-circle'} tone={note.ok ? 'ok' : 'info'}>
          {note.text}
        </InfoNote>
      ) : null}

      <View style={styles.section}>
        <Overline>Work</Overline>
        <Text style={styles.small}>Photos from jobs confirmed by clients. Tap to see them big.</Text>
        {b.work.length ? (
          <View style={styles.grid}>
            {b.work.map((w, i) => (
              <Pressable key={w.id} accessibilityRole="button" accessibilityLabel={`${w.stageName}, ${w.jobTitle}. Open the slideshow`} onPress={() => setSlide(i)} style={[styles.tile, { width: tile }]}>
                <Image source={w.photo} style={[styles.thumb, { width: tile, height: tile }]} resizeMode="cover" />
                <Text style={styles.tileText} numberOfLines={1}>
                  {w.stageName}
                </Text>
                <Text style={styles.tileSub} numberOfLines={1}>
                  {w.suburb}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={styles.muted}>{first} hasn&apos;t chosen any work to show yet.</Text>
        )}
      </View>

      {b.reasons.length ? (
        <View style={styles.section}>
          <Overline>Why you see {first}</Overline>
          <Card style={{ gap: 8 }}>
            {b.reasons.map((r) => (
              <View key={r} style={styles.reason}>
                <Feather name="check" size={15} color={colors.jade} />
                <Text style={styles.reasonText}>{r}</Text>
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      <InfoNote icon="shield">Every photo here is from a stage a client confirmed on Akayza. Clients&apos; names, numbers and addresses are never shown.</InfoNote>

      {slide !== null ? <WorkSlideshow items={b.work} start={slide} name={first} onClose={() => setSlide(null)} /> : null}
      {showMe ? <ShowMeSheet onClose={() => setShowMe(false)} /> : null}
      {menu ? (
        <ReportBlockSheet
          name={b.name}
          onClose={() => setMenu(false)}
          onReport={async (reason, text) => {
            await networkApi.report(b.id, reason, text);
            setMenu(false);
            setNote({ text: `Thanks. We'll look at your report about ${first}.`, ok: true });
          }}
          onBlock={async () => {
            await networkApi.block(b.id);
            setMenu(false);
            router.back();
          }}
        />
      ) : null}
    </Screen>
  );
}

function Proof({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.proofBox}>
      <Text style={styles.proofValue}>{value}</Text>
      <Text style={styles.proofLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: 40, alignItems: 'center' },
  center: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  muted: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted, textAlign: 'center' },
  small: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.textMuted },
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  more: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  who: { alignItems: 'center', gap: 4 },
  trades: { fontFamily: fonts.bold, fontSize: 15, color: colors.accentDeep },
  about: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.text, textAlign: 'center', marginTop: 4 },
  proof: { flexDirection: 'row', gap: 8 },
  proofBox: { flex: 1, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 10, gap: 2 },
  proofValue: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  proofLabel: { fontFamily: fonts.medium, fontSize: 11.5, lineHeight: 15, color: colors.textMuted },
  section: { gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { gap: 4 },
  thumb: { borderRadius: radius.md, backgroundColor: colors.line },
  tileText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.text },
  tileSub: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: -2 },
  reason: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  reasonText: { flex: 1, fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, color: colors.text },
});
