import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { ApiError } from '@/shared/api/client';
import { Button } from '@/shared/components/Button';
import { Card, InfoNote, ToggleRow } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Overline, Title } from '@/shared/components/Text';
import { TextField } from '@/shared/components/TextField';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { networkApi } from '../api/networkApi';
import { ABOUT_MAX, MAX_TRADES, TRAVEL_CHOICES } from '../lib/limits';
import { TRADES, type Trade } from '../lib/trades';
import type { MyBuild } from '../types';

/** The questions builders ask before showing themselves (15_JOBS_BUILDER_NETWORK_PLAN.txt). */
const QUESTIONS: [string, string][] = [
  ['Will other builders take my clients?', "No. Your clients' names and numbers are never shown."],
  ['Who sees my number?', 'Only builders you work a job with: an invite you accept, or a help post where you are picked.'],
  ['Can I hide my work?', 'Yes. You choose every build, and you can hide everything any time.'],
  ['What if someone is fake?', "Builds come from stages clients confirmed. Report or block anyone from their profile's ..."],
  ['How do I get paid as a partner?', 'The builder states your pay before you say yes. They pay you in cash, and you both confirm it.'],
  ['Does it cost money or data?', "It's free. Small photos load first."],
];

/**
 * Your builder profile: trades, one line about you, how far you travel,
 * "Show me to other builders" (off until you turn it on), and which of
 * your client-confirmed builds other builders see.
 */
export default function MyBuilderProfileScreen() {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [about, setAbout] = useState('');
  const [travelKm, setTravelKm] = useState(20);
  const [visible, setVisible] = useState(false);
  const [builds, setBuilds] = useState<MyBuild[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    networkApi
      .myProfile()
      .then((p) => {
        if (!live) return;
        setTrades(p.trades);
        setAbout(p.about);
        setTravelKm(p.travelKm);
        setVisible(p.visible);
        setBuilds(p.builds);
        setFailed(false);
        setReady(true);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [attempt]);

  function toggleTrade(t: Trade) {
    setTrades((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : cur.length >= MAX_TRADES ? cur : [...cur, t]));
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await networkApi.saveMyProfile({ trades, about, travelKm, visible, shownBuildIds: builds.filter((b) => b.shown).map((b) => b.id) });
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save. Check your connection and try again.");
      setSaving(false);
    }
  }

  if (!ready) {
    return (
      <Screen back>
        {failed ? (
          <Card style={styles.center}>
            <Text style={styles.muted}>Couldn&apos;t open your builder profile. Check your connection and try again.</Text>
            <Button title="Try again" variant="secondary" onPress={() => setAttempt((n) => n + 1)} />
          </Card>
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}
      </Screen>
    );
  }

  return (
    <Screen back footer={<Button title="Save" loading={saving} disabled={trades.length === 0} onPress={save} />}>
      <Title>Your builder profile</Title>

      <ToggleRow
        icon="eye"
        title="Show me to other builders"
        subtitle="So they can find you and see your work. Turn it off any time; your profile disappears at once."
        value={visible}
        onChange={setVisible}
      />

      <View style={styles.section}>
        <Overline>Your trades (up to {MAX_TRADES})</Overline>
        <View style={styles.chips}>
          {TRADES.map((t) => {
            const on = trades.includes(t.key);
            return (
              <Pressable key={t.key} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => toggleTrade(t.key)} style={[styles.chip, on && styles.chipOn]}>
                {on ? <Feather name="check" size={14} color={colors.white} /> : null}
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <TextField label="What you do, in one line" optional value={about} onChangeText={setAbout} maxLength={ABOUT_MAX} placeholder="Bathrooms and kitchens, neat and on time" />

      <View style={styles.section}>
        <Overline>How far you travel for work</Overline>
        <View style={styles.chips}>
          {TRAVEL_CHOICES.map((km) => (
            <Pressable key={km} accessibilityRole="radio" accessibilityState={{ checked: travelKm === km }} onPress={() => setTravelKm(km)} style={[styles.chip, travelKm === km && styles.chipOn]}>
              <Text style={[styles.chipText, travelKm === km && styles.chipTextOn]}>{km} km</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Overline>Your builds</Overline>
        <Text style={styles.small}>Jobs your clients confirmed, with their stage photos. Choose what other builders see.</Text>
        {builds.length ? (
          <Card style={{ paddingVertical: 0 }}>
            {builds.map((w, i) => (
              <View key={w.id} style={[styles.workRow, i < builds.length - 1 && styles.rule]}>
                {w.photos[0] ? <Image source={w.photos[0].photo} style={styles.thumb} /> : null}
                <View style={{ flex: 1 }}>
                  <Text style={styles.workTitle}>{w.title}</Text>
                  <Text style={styles.small}>
                    {w.suburb} · {w.photos.length === 1 ? '1 photo' : `${w.photos.length} photos`}
                  </Text>
                </View>
                <Switch
                  value={w.shown}
                  onValueChange={(v) => setBuilds((cur) => cur.map((x) => (x.id === w.id ? { ...x, shown: v } : x)))}
                  accessibilityLabel={`Show ${w.title}`}
                  trackColor={{ false: colors.line, true: colors.ink }}
                  thumbColor={colors.white}
                />
              </View>
            ))}
          </Card>
        ) : (
          <Text style={styles.muted}>Your builds show up here when a client confirms a job&apos;s stages with photos.</Text>
        )}
        <InfoNote icon="camera">Avoid faces and house numbers. Only the suburb is shown, never the address.</InfoNote>
      </View>

      {error ? <InfoNote icon="alert-circle">{error}</InfoNote> : null}

      <View style={styles.section}>
        <Overline>Your questions</Overline>
        <Card style={{ gap: 12 }}>
          {QUESTIONS.map(([q, a]) => (
            <View key={q} style={{ gap: 2 }}>
              <Text style={styles.q}>{q}</Text>
              <Text style={styles.small}>{a}</Text>
            </View>
          ))}
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: 40, alignItems: 'center' },
  center: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  muted: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted },
  small: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.textMuted },
  section: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  chipTextOn: { color: colors.white },
  workRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rule: { borderBottomWidth: 1, borderBottomColor: colors.line },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.line },
  workTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  q: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
});
