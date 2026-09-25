import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { areaOf } from '@/features/auth/profile';
import { useSession } from '@/features/auth/session/SessionProvider';
import { ApiError } from '@/shared/api/client';
import { Button } from '@/shared/components/Button';
import { Card, InfoNote } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Overline, Title } from '@/shared/components/Text';
import { TextField } from '@/shared/components/TextField';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { jobsApi } from '../../api/jobsApi';
import type { Job } from '../../types';
import { networkApi } from '../api/networkApi';
import { ShowMeSheet } from '../components/ShowMeSheet';
import { MAX_POST_DAYS, SUBURB_MAX, WHAT_MAX } from '../lib/limits';
import { daysText, neededText, startChoices } from '../lib/postText';
import { TRADES, type Trade } from '../lib/trades';

/** The job's place, cut to its suburb: "Tembisa, Ext 5" -> "Tembisa". Never the street. */
function suburbOf(place: string): string {
  return place.split(',')[0]?.trim() ?? '';
}

/**
 * "Need help on this job?": the trade, what for, when and for how long.
 * The area is the job's suburb (never its address). Builders of that trade
 * near the job see it for 7 days; you pick one, and you both get each
 * other's number.
 */
export default function NewHelpPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useSession();
  const [job, setJob] = useState<Job | null>(null);
  const [failed, setFailed] = useState(false);
  const [trade, setTrade] = useState<Trade | null>(null);
  const [what, setWhat] = useState('');
  const days = startChoices();
  const [startsOn, setStartsOn] = useState(days[1]!.iso);
  const [length, setLength] = useState(2);
  const [suburb, setSuburb] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showMe, setShowMe] = useState(false);

  useEffect(() => {
    let live = true;
    jobsApi
      .get(id ?? '')
      .then((j) => {
        if (!live) return;
        setJob(j);
        setSuburb(suburbOf(j.place) || areaOf(profile));
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
    // The job decides the default area once; later profile changes don't overwrite what was typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function post() {
    if (saving || !job || !trade) return;
    setSaving(true);
    setError('');
    try {
      const created = await networkApi.createHelpPost(job.id, { trade, what, startsOn, days: length, suburb });
      router.replace({ pathname: '/informal-business/jobs/help/[postId]', params: { postId: created.id } });
    } catch (err) {
      setSaving(false);
      if (err instanceof ApiError && err.code === 'PROFILE_HIDDEN') setShowMe(true);
      else setError(err instanceof ApiError ? err.message : "Couldn't post it. Check your connection and try again.");
    }
  }

  if (!job) {
    return (
      <Screen back>
        {failed ? (
          <Text style={styles.muted}>We couldn&apos;t open that job.</Text>
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}
      </Screen>
    );
  }

  const ready = !!trade && /\p{L}/u.test(what) && /\p{L}/u.test(suburb);

  return (
    <Screen back footer={<Button title="Post it" icon="send" loading={saving} disabled={!ready} onPress={post} />}>
      <View>
        <Title>Need help on this job?</Title>
        <Text style={styles.sub}>{job.title}</Text>
      </View>

      <View style={styles.section}>
        <Overline>Who do you need?</Overline>
        <View style={styles.chips}>
          {TRADES.map((t) => (
            <Pressable key={t.key} accessibilityRole="radio" accessibilityState={{ checked: trade === t.key }} onPress={() => setTrade(t.key)} style={[styles.chip, trade === t.key && styles.chipOn]}>
              <Text style={[styles.chipText, trade === t.key && styles.chipTextOn]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <TextField label="What for?" value={what} onChangeText={setWhat} maxLength={WHAT_MAX} placeholder="Bathroom pipes and geyser" />

      <View style={styles.section}>
        <Overline>Starting</Overline>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.dayRow}>
          {days.map((d) => (
            <Pressable key={d.iso} accessibilityRole="radio" accessibilityState={{ checked: startsOn === d.iso }} onPress={() => setStartsOn(d.iso)} style={[styles.chip, startsOn === d.iso && styles.chipOn]}>
              <Text style={[styles.chipText, startsOn === d.iso && styles.chipTextOn]}>{d.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Overline>For how long?</Overline>
        <View style={styles.stepper}>
          <Pressable accessibilityRole="button" accessibilityLabel="One day less" disabled={length <= 1} onPress={() => setLength((n) => Math.max(1, n - 1))} style={[styles.step, length <= 1 && { opacity: 0.4 }]}>
            <Feather name="minus" size={20} color={colors.ink} />
          </Pressable>
          <Text style={styles.stepValue}>{daysText(length)}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="One day more"
            disabled={length >= MAX_POST_DAYS}
            onPress={() => setLength((n) => Math.min(MAX_POST_DAYS, n + 1))}
            style={[styles.step, length >= MAX_POST_DAYS && { opacity: 0.4 }]}>
            <Feather name="plus" size={20} color={colors.ink} />
          </Pressable>
        </View>
      </View>

      <TextField label="Area" value={suburb} onChangeText={setSuburb} maxLength={SUBURB_MAX} hint="The suburb only, never the street address." />

      {trade ? (
        <Card style={{ gap: 4 }}>
          <Text style={styles.previewLabel}>Builders will see</Text>
          <Text style={styles.previewTitle}>{neededText(trade)}</Text>
          <Text style={styles.muted}>
            {[what.trim(), suburb.trim(), `from ${days.find((d) => d.iso === startsOn)?.label.toLowerCase()}`, daysText(length)].filter(Boolean).join(' · ')}
          </Text>
        </Card>
      ) : null}

      <InfoNote icon="users">
        {trade ? `${TRADES.find((t) => t.key === trade)?.label}s` : 'Builders'} near {suburb.trim() || 'the job'} see it for 7 days. You choose who you want; then you both get each other&apos;s number. Your client&apos;s details are never shown.
      </InfoNote>

      {error ? <InfoNote icon="alert-circle">{error}</InfoNote> : null}
      {showMe ? <ShowMeSheet onClose={() => setShowMe(false)} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: 40, alignItems: 'center' },
  muted: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted },
  sub: { fontFamily: fonts.body, fontSize: 13.5, color: colors.textMuted, marginTop: 2 },
  section: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  chipTextOn: { color: colors.white },
  bleed: { marginHorizontal: -20 },
  dayRow: { paddingHorizontal: 20, gap: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  step: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontFamily: fonts.display, fontSize: 20, color: colors.ink, minWidth: 90, textAlign: 'center' },
  previewLabel: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  previewTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
});
