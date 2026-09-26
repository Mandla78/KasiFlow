import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { UndoSnackbar } from '@/features/dashboard/informal-business/credit-book/components/UndoSnackbar';
import { Card, IconTile, ListRow, Tag } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Title } from '@/shared/components/Text';
import { colors, fonts } from '@/shared/theme/tokens';

import { jobsApi } from '../api/jobsApi';
import { PaidProgress } from '../components/PaidProgress';
import { confirmedCents, currentStage, statusLabel } from '../lib/stages';
import { Job } from '../types';

/**
 * Jobs (builders and trades): active jobs with what's paid and confirmed,
 * and the next stage. Done jobs live in History, deleted ones in the bin.
 * Each job is paid in stages, and each stage is a photo plus the client's
 * sign-off.
 */
export default function JobsScreen() {
  const params = useLocalSearchParams<{ binned?: string }>();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    let live = true;
    setFailed(false);
    jobsApi
      .list()
      .then((rows) => live && setJobs(rows))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);
  useFocusEffect(load);

  const active = (jobs ?? []).filter((j) => j.status === 'active');
  const done = (jobs ?? []).filter((j) => j.status === 'done').length;
  const forgetBinned = useCallback(() => router.setParams({ binned: '' }), []);
  const undoBin = useCallback(async () => {
    if (params.binned) await jobsApi.restore(params.binned);
    load();
  }, [params.binned, load]);

  const open = (j: Job) => router.push({ pathname: '/informal-business/jobs/[id]', params: { id: j.id } });

  return (
    <Screen
      back
      footer={
        <>
          {params.binned ? <UndoSnackbar message="Moved to the bin." onUndo={undoBin} onDone={forgetBinned} /> : null}
          <Button title="New job" icon="plus" onPress={() => router.push('/informal-business/jobs/new')} />
        </>
      }>
      <Title>Jobs</Title>

      {failed ? (
        <Card style={styles.center}>
          <IconTile name="wifi-off" size={44} />
          <Text style={styles.muted}>Couldn&apos;t open your jobs. Check your connection and try again.</Text>
          <Button title="Try again" variant="secondary" onPress={load} />
        </Card>
      ) : !jobs ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <>
          {active.length === 0 ? (
            <Card style={styles.center}>
              <IconTile name="tool" size={44} />
              <Text style={styles.muted}>
                {done ? 'No active jobs. Your finished ones are in History.' : "No jobs yet. Add a job with its stages; each stage gets a photo and the client's sign-off."}
              </Text>
            </Card>
          ) : null}
          {active.map((j) => (
            <JobCard key={j.id} job={j} onPress={() => open(j)} />
          ))}

          <Card style={{ paddingVertical: 4 }}>
            <ListRow
              icon="shield"
              title="House records"
              subtitle="Every stage with its photo and sign-off, to show new clients"
              onPress={() => router.push('/informal-business/jobs/records')}
            />
            <ListRow
              icon="clock"
              title="History"
              subtitle={done ? `Done jobs (${done}) and the bin` : 'Done jobs and the bin'}
              onPress={() => router.push('/informal-business/jobs/history')}
              last
            />
          </Card>
        </>
      )}
    </Screen>
  );
}

function JobCard({ job, onPress }: { job: Job; onPress: () => void }) {
  const next = currentStage(job);
  const label = next ? statusLabel(next) : null;
  return (
    <Card onPress={onPress} style={{ gap: 10 }}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{job.title}</Text>
          <Text style={styles.sub}>{[job.clientName, job.place].filter(Boolean).join(' · ')}</Text>
        </View>
        {job.status === 'done' ? <Tag label="Done" tone="jade" /> : null}
      </View>
      <PaidProgress compact confirmedCents={confirmedCents(job)} totalCents={job.totalCents} />
      {next && label ? (
        <View style={styles.next}>
          <Text style={styles.nextText}>Next: {next.name}</Text>
          <Tag label={label.text} tone={label.tone} />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: 40, alignItems: 'center' },
  center: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  muted: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted, textAlign: 'center' },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, marginTop: 2 },
  next: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  nextText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
});
