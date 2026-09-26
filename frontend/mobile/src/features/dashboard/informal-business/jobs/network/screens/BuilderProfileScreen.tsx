import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useSession } from '@/features/auth/session/SessionProvider';
import { SupplierAvatar } from '@/features/dashboard/informal-business/suppliers/components/SupplierAvatar';
import { ApiError } from '@/shared/api/client';
import { Button } from '@/shared/components/Button';
import { Card, IconTile, InfoNote } from '@/shared/components/Parts';
import { BackButton, Screen } from '@/shared/components/Screen';
import { Sheet } from '@/shared/components/Sheet';
import { Overline, Title } from '@/shared/components/Text';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { jobsApi } from '../../api/jobsApi';
import type { Job } from '../../types';
import { networkApi } from '../api/networkApi';
import { BuildCard } from '../components/BuildCard';
import { ContactButtons } from '../components/ContactButtons';
import { ReportBlockSheet } from '../components/ReportBlockSheet';
import { WorkSlideshow } from '../components/WorkSlideshow';
import { helloText } from '../lib/contact';
import { listText } from '../lib/pay';
import { kmText } from '../lib/recommend';
import { tradesText } from '../lib/trades';
import type { Build, BuilderProfile } from '../types';

function since(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
}

/**
 * Another builder's profile: a portfolio of builds their clients confirmed
 * (tap one for its stages, full screen), proof numbers, who they've built
 * with, and why you see them. "Invite to a job" (with the pay stated
 * first), or Save them for later; WhatsApp and Call once you're partners.
 * "..." reports or blocks. Never their clients, never an address.
 */
export default function BuilderProfileScreen() {
  const { builderId } = useLocalSearchParams<{ builderId: string }>();
  const { profile: mine } = useSession();
  const [b, setB] = useState<BuilderProfile | null>(null);
  const [failure, setFailure] = useState<'missing' | 'network' | null>(null);
  const [build, setBuild] = useState<Build | null>(null);
  const [menu, setMenu] = useState(false);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  const at = mine.location ?? undefined;

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

  async function toggleSaved(p: BuilderProfile) {
    setNote(null);
    try {
      await networkApi.setSaved(p.id, p.relation !== 'saved');
      setB(await networkApi.builder(p.id, at));
    } catch (err) {
      setNote({ text: err instanceof ApiError ? err.message : "Couldn't save. Check your connection and try again.", ok: false });
    }
  }

  async function pickJob() {
    setNote(null);
    try {
      const active = (await jobsApi.list()).filter((j) => j.status === 'active');
      setJobs(active);
    } catch {
      setNote({ text: "Couldn't open your jobs. Check your connection and try again.", ok: false });
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
        <Text style={[styles.muted, { textAlign: 'center' }]}>
          {b.suburb} · {kmText(b.distanceKm)} · on Akayza since {since(b.onAkayzaSince)}
        </Text>
        {b.about ? <Text style={styles.about}>“{b.about}”</Text> : null}
        {b.relation === 'partner' ? <Text style={styles.partner}>Your partner</Text> : null}
      </View>

      <View style={styles.proof}>
        <Proof value={b.buildsConfirmed} label={b.buildsConfirmed === 1 ? 'build confirmed by a client' : 'builds confirmed by clients'} />
        <Proof value={b.confirmedStages} label={b.confirmedStages === 1 ? 'stage confirmed' : 'stages confirmed'} />
        <Proof value={b.workedWith.length} label={b.workedWith.length === 1 ? 'partner' : 'partners'} />
      </View>

      {b.relation === 'partner' && b.phone ? <ContactButtons name={b.name} phone={b.phone} message={helloText(b.name, mine.ownerName || mine.businessName)} /> : null}
      <View style={styles.actions}>
        <View style={{ flex: 1 }}>
          <Button title="Invite to a job" icon="briefcase" onPress={pickJob} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={b.relation === 'saved' ? `Saved. Tap to remove ${first}` : `Save ${first}`}
          accessibilityState={{ selected: b.relation === 'saved' }}
          disabled={b.relation === 'partner'}
          onPress={() => toggleSaved(b)}
          style={[styles.save, b.relation === 'saved' && styles.saveOn, b.relation === 'partner' && { opacity: 0.4 }]}>
          <Feather name="bookmark" size={18} color={b.relation === 'saved' ? colors.white : colors.ink} />
          <Text style={[styles.saveText, b.relation === 'saved' && { color: colors.white }]}>{b.relation === 'saved' ? 'Saved' : 'Save'}</Text>
        </Pressable>
      </View>
      <Text style={styles.small}>You state the pay before {first} says yes. Numbers are shared once they accept.</Text>

      {note ? (
        <InfoNote icon={note.ok ? 'check-circle' : 'alert-circle'} tone={note.ok ? 'ok' : 'info'}>
          {note.text}
        </InfoNote>
      ) : null}

      <View style={styles.section}>
        <Overline>Builds</Overline>
        <Text style={styles.small}>Jobs clients confirmed stage by stage. Tap one to see its stages.</Text>
        {b.builds.length ? (
          b.builds.map((x) => <BuildCard key={x.id} build={x} onPress={() => setBuild(x)} />)
        ) : (
          <Text style={styles.muted}>{first} hasn&apos;t chosen any builds to show yet.</Text>
        )}
      </View>

      {b.workedWith.length ? (
        <View style={styles.section}>
          <Overline>Worked with</Overline>
          <Text style={styles.body}>{listText(b.workedWith)}</Text>
        </View>
      ) : null}

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

      {build ? <WorkSlideshow items={build.photos} title={build.title} suburb={build.suburb} onClose={() => setBuild(null)} /> : null}

      {jobs ? (
        <Sheet visible onClose={() => setJobs(null)}>
          <Text style={styles.sheetTitle}>Invite {first} to which job?</Text>
          {jobs.length ? (
            jobs.map((j) => (
              <Pressable
                key={j.id}
                accessibilityRole="button"
                onPress={() => {
                  setJobs(null);
                  router.push({ pathname: '/informal-business/jobs/[id]/partner', params: { id: j.id, builderId: b.id } });
                }}
                style={styles.jobRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.jobTitle}>{j.title}</Text>
                  <Text style={styles.small}>{j.place}</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.textFaint} />
              </Pressable>
            ))
          ) : (
            <Text style={styles.body}>You have no active jobs. Add a job first, then invite {first} onto it.</Text>
          )}
          <Button title="Cancel" variant="secondary" onPress={() => setJobs(null)} />
        </Sheet>
      ) : null}

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
  muted: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted },
  small: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.textMuted },
  body: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.text },
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
  partner: { fontFamily: fonts.bold, fontSize: 13, color: colors.jade, marginTop: 2 },
  proof: { flexDirection: 'row', gap: 8 },
  proofBox: { flex: 1, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 10, gap: 2 },
  proofValue: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  proofLabel: { fontFamily: fonts.medium, fontSize: 11.5, lineHeight: 15, color: colors.textMuted },
  actions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  save: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 52,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  saveOn: { backgroundColor: colors.accentDeep, borderColor: colors.accentDeep },
  saveText: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  section: { gap: 8 },
  reason: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  reasonText: { flex: 1, fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, color: colors.text },
  sheetTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.ink },
  jobRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, borderBottomWidth: 1, borderBottomColor: colors.line },
  jobTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
});
