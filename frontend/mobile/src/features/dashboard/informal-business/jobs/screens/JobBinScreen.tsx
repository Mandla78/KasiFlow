import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/shared/api/client';
import { Button } from '@/shared/components/Button';
import { Card, IconTile, InfoNote } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Title } from '@/shared/components/Text';
import { formatRand } from '@/shared/lib/money';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { jobsApi } from '../api/jobsApi';
import { Job } from '../types';

/**
 * The jobs bin: jobs deleted in the last 30 days, to restore. Deleting only
 * hid them from the builder; stages the client confirmed stay in the record.
 */
export default function JobBinScreen() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(() => {
    let live = true;
    setFailed(false);
    jobsApi
      .bin()
      .then((rows) => live && setJobs(rows))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);
  useFocusEffect(load);

  async function restore(j: Job) {
    if (busy) return;
    setBusy(j.id);
    setNote(null);
    try {
      await jobsApi.restore(j.id);
      setJobs((rows) => (rows ?? []).filter((x) => x.id !== j.id));
      setNote({ text: `Restored. ${j.title} is back in your jobs.`, ok: true });
    } catch (err) {
      setNote({ text: err instanceof ApiError ? err.message : "Couldn't restore it. Try again.", ok: false });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen back>
      <Title>Bin</Title>
      <Text style={styles.sub}>Kept for 30 days, then removed from your view.</Text>

      {note ? (
        <InfoNote icon={note.ok ? 'check-circle' : 'alert-circle'} tone={note.ok ? 'ok' : 'info'}>
          {note.text}
        </InfoNote>
      ) : null}

      {failed ? (
        <Card style={styles.center}>
          <IconTile name="wifi-off" size={44} />
          <Text style={styles.muted}>Couldn&apos;t open the bin. Check your connection and try again.</Text>
          <Button title="Try again" variant="secondary" onPress={load} />
        </Card>
      ) : !jobs ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : jobs.length === 0 ? (
        <Card style={styles.center}>
          <IconTile name="trash-2" size={44} />
          <Text style={styles.muted}>The bin is empty.</Text>
        </Card>
      ) : (
        <Card style={{ paddingVertical: 0 }}>
          {jobs.map((j, i) => (
            <View key={j.id} style={[styles.row, i < jobs.length - 1 && styles.rule]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.name}>{j.title}</Text>
                <Text style={styles.detail}>
                  {j.clientName} · {formatRand(j.totalCents)}
                </Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={`Restore ${j.title}`} onPress={() => restore(j)} style={styles.restore}>
                {busy === j.id ? <ActivityIndicator size="small" color={colors.ink} /> : <Text style={styles.restoreText}>Restore</Text>}
              </Pressable>
            </View>
          ))}
        </Card>
      )}

      <InfoNote icon="shield">Deleting only hides a job from you. Stages your clients confirmed stay in your record.</InfoNote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { fontFamily: fonts.body, fontSize: 13.5, color: colors.textMuted, marginTop: -8 },
  loading: { paddingVertical: 40, alignItems: 'center' },
  center: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  muted: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  rule: { borderBottomWidth: 1, borderBottomColor: colors.line },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  detail: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  restore: { minWidth: 88, minHeight: 40, paddingHorizontal: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  restoreText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
});
