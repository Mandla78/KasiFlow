import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { USE_MOCK_AUTH } from '@/constants/config';
import { ApiError } from '@/shared/api/client';
import { Button } from '@/shared/components/Button';
import { Card, IconTile, InfoNote, ListRow } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Title } from '@/shared/components/Text';
import { formatRand } from '@/shared/lib/money';
import { colors, fonts } from '@/shared/theme/tokens';

import { jobsApi } from '../api/jobsApi';
import { PaidProgress } from '../components/PaidProgress';
import { SignOffSheet } from '../components/SignOffSheet';
import { StageStep } from '../components/StageStep';
import { confirmedCents, currentStage } from '../lib/stages';
import { Job } from '../types';

/**
 * A job (PDF p12): its stages as steps, what's paid and confirmed, and the
 * two things a builder does per stage: take the photo, send the sign-off.
 * Tap a stage to work on it; the first unconfirmed one is picked for you.
 */
export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [failure, setFailure] = useState<'missing' | 'network' | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [signOff, setSignOff] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(() => {
    let live = true;
    setFailure(null);
    // A note is about the moment it was shown; coming back, the stages say what happened.
    setNote('');
    jobsApi
      .get(id ?? '')
      .then((j) => live && setJob(j))
      .catch((e) => live && setFailure(e instanceof ApiError && e.status === 404 ? 'missing' : 'network'));
    return () => {
      live = false;
    };
  }, [id]);
  // Reload on focus: the photo and practice screens change the job.
  useFocusEffect(load);

  if (failure) {
    return (
      <Screen back>
        <Card style={styles.center}>
          <IconTile name={failure === 'missing' ? 'search' : 'wifi-off'} size={44} />
          <Text style={styles.muted}>{failure === 'missing' ? "We couldn't find that job." : "Couldn't open this job. Check your connection and try again."}</Text>
          {failure === 'network' ? <Button title="Try again" variant="secondary" onPress={load} /> : null}
        </Card>
      </Screen>
    );
  }

  if (!job) {
    return (
      <Screen back>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </Screen>
    );
  }

  const stage = job.stages.find((s) => s.id === picked) ?? currentStage(job);
  const open = stage && stage.status !== 'confirmed';

  return (
    <Screen
      back
      footer={
        open && stage ? (
          <>
            <Button title="Send sign-off link to client" icon="share-2" onPress={() => setSignOff(true)} />
            <Button
              title={stage.photo ? 'Retake stage photo' : 'Take stage photo'}
              icon="camera"
              variant="secondary"
              onPress={() => router.push({ pathname: '/informal-business/jobs/[id]/stages/[stageId]/photo', params: { id: job.id, stageId: stage.id } })}
            />
          </>
        ) : (
          <Button
            title="Show the house record"
            icon="shield"
            variant="secondary"
            onPress={() => router.push({ pathname: '/informal-business/jobs/[id]/record', params: { id: job.id } })}
          />
        )
      }>
      <View>
        <Title>{job.title}</Title>
        <Text style={styles.sub}>
          {job.clientName} · {formatRand(job.totalCents)}
          {job.place ? ` · ${job.place}` : ''}
        </Text>
      </View>

      {note ? (
        <InfoNote icon="check-circle" tone="ok">
          {note}
        </InfoNote>
      ) : null}

      <PaidProgress confirmedCents={confirmedCents(job)} totalCents={job.totalCents} />

      <Card style={{ paddingVertical: 2 }}>
        {job.stages.map((s, i) => (
          <StageStep key={s.id} stage={s} selected={s.id === stage?.id} onPress={() => setPicked(s.id)} last={i === job.stages.length - 1} />
        ))}
      </Card>

      {stage?.status === 'amounts_dont_match' ? (
        <InfoNote icon="alert-circle">
          You and {job.clientName} typed different amounts for {stage.name}. Talk to them, then send the sign-off again. Both numbers stay in the record.
        </InfoNote>
      ) : null}

      {USE_MOCK_AUTH && stage?.status === 'waiting' ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/informal-business/jobs/[id]/sign-off-practice', params: { id: job.id, stageId: stage.id } })}
          style={styles.practice}>
          <Feather name="smartphone" size={15} color={colors.accentDeep} />
          <Text style={styles.practiceText}>Test: answer as {job.clientName}</Text>
        </Pressable>
      ) : null}

      <Card style={{ paddingVertical: 4 }}>
        <ListRow
          icon="shield"
          title="House record"
          subtitle="This job's stages with photos and sign-offs"
          onPress={() => router.push({ pathname: '/informal-business/jobs/[id]/record', params: { id: job.id } })}
          last
        />
      </Card>

      {signOff && stage ? (
        <SignOffSheet
          job={job}
          stage={stage}
          onClose={() => setSignOff(false)}
          onSent={(next) => {
            setJob(next);
            setSignOff(false);
            setNote(`Sign-off for ${stage.name} sent. It's confirmed when ${job.clientName} answers with the same amount.`);
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: 40, alignItems: 'center' },
  center: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  muted: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted, textAlign: 'center' },
  sub: { fontFamily: fonts.body, fontSize: 13.5, color: colors.textMuted, marginTop: 2 },
  practice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44 },
  practiceText: { fontFamily: fonts.bold, fontSize: 14, color: colors.accentDeep },
});
