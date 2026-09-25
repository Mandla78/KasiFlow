import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useSession } from '@/features/auth/session/SessionProvider';
import { Button } from '@/shared/components/Button';
import { Card, IconTile, InfoNote, Tag } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Title } from '@/shared/components/Text';
import { colors, fonts } from '@/shared/theme/tokens';

import { jobsApi } from '../api/jobsApi';
import { RecordStageRow } from '../components/RecordStageRow';
import { Job, Stage } from '../types';

/** A stage belongs in the record once there's proof: a photo, or both sides' amounts. */
const recorded = (s: Stage) => !!s.photo || s.status === 'confirmed' || s.status === 'amounts_dont_match';

/**
 * House records (PDF p15): each job's stages as a record, "Both ✓✓" when
 * the client confirmed, "By you ✓" when only the builder has so far. With
 * an id, one job; without, every job. Sharing a read-only link comes with
 * the backend (the same rules as My record's share link).
 */
export default function HouseRecordsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { profile } = useSession();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [shareNote, setShareNote] = useState(false);

  const load = useCallback(() => {
    let live = true;
    setFailed(false);
    (id ? jobsApi.get(id).then((j) => [j]) : jobsApi.list())
      .then((rows) => live && setJobs(rows))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [id]);
  useFocusEffect(load);

  const withRecords = (jobs ?? []).map((j) => ({ job: j, stages: j.stages.filter(recorded) })).filter((x) => x.stages.length > 0);

  return (
    <Screen back footer={withRecords.length ? <Button title="Share a house record" icon="share-2" onPress={() => setShareNote(true)} /> : undefined}>
      <View>
        <Title>House records</Title>
        <Text style={styles.sub}>{profile.businessName}</Text>
      </View>

      {shareNote ? (
        <InfoNote icon="info">
          Sharing comes with the backend: a read-only link you send to a new client, that you can stop sharing any time. It shows stages, photos and sign-offs, never your clients&apos; names or numbers.
        </InfoNote>
      ) : null}

      {failed ? (
        <Card style={styles.center}>
          <IconTile name="wifi-off" size={44} />
          <Text style={styles.muted}>Couldn&apos;t open your records. Check your connection and try again.</Text>
          <Button title="Try again" variant="secondary" onPress={load} />
        </Card>
      ) : !jobs ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : withRecords.length === 0 ? (
        <Card style={styles.center}>
          <IconTile name="shield" size={44} />
          <Text style={styles.muted}>Nothing recorded yet. Take a stage photo and get the client&apos;s sign-off, and it shows here.</Text>
        </Card>
      ) : (
        withRecords.map(({ job, stages }) => (
          <Card key={job.id} style={{ gap: 2 }}>
            <View style={styles.jobHead}>
              <Text style={styles.jobTitle}>{job.title}</Text>
              <Tag label="Captured live" tone="jade" />
            </View>
            {stages.map((s, i) => (
              <RecordStageRow key={s.id} stage={s} last={i === stages.length - 1} />
            ))}
          </Card>
        ))
      )}

      <Text style={styles.footnote}>Every stage here was captured in the app, so its photo time and the client&apos;s sign-off can be checked.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { fontFamily: fonts.body, fontSize: 13.5, color: colors.textMuted, marginTop: 2 },
  loading: { paddingVertical: 40, alignItems: 'center' },
  center: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  muted: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted, textAlign: 'center' },
  jobHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingBottom: 4 },
  jobTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  footnote: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
});
