import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

import { useSession } from '@/features/auth/session/SessionProvider';
import { AmountField } from '@/features/dashboard/informal-business/credit-book/components/AmountField';
import { parseRand } from '@/features/dashboard/informal-business/credit-book/lib/amounts';
import { ApiError } from '@/shared/api/client';
import { Button } from '@/shared/components/Button';
import { Card, InfoNote, Tag } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Title } from '@/shared/components/Text';
import { TextField } from '@/shared/components/TextField';
import { formatRand } from '@/shared/lib/money';
import { colors, fonts } from '@/shared/theme/tokens';

import { jobsApi } from '../api/jobsApi';
import { answerPractice } from '../api/mockJobsApi';
import { MAX_JOB_CENTS, NOTE_MAX } from '../lib/stages';
import { Job, StageStatus } from '../types';

/**
 * TEST ONLY: the client's sign-off page (PDF p14), inside the app so the
 * whole loop can be tried on one phone. The real page is a web page on the
 * backend, opened from the WhatsApp link, with no app and no login. The
 * client types their OWN amount; the builder's is never shown here.
 */
export default function PracticeSignOffScreen() {
  const { id, stageId } = useLocalSearchParams<{ id: string; stageId: string }>();
  const { profile } = useSession();
  const [job, setJob] = useState<Job | null>(null);
  const [amount, setAmount] = useState('');
  const [notYet, setNotYet] = useState(false);
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const [result, setResult] = useState<StageStatus | null>(null);

  useEffect(() => {
    let live = true;
    jobsApi
      .get(id ?? '')
      .then((j) => live && setJob(j))
      .catch(() => live && setFailure('This link has already been used or has expired.'));
    return () => {
      live = false;
    };
  }, [id]);

  const stage = job?.stages.find((s) => s.id === stageId);
  const business = profile.businessName || 'The builder';
  const cents = amount.trim() === '' ? 0 : parseRand(amount);
  const amountError = cents === null ? 'Type an amount like 12000, or leave it empty' : cents > MAX_JOB_CENTS ? 'That amount is too big' : '';

  async function answer(kind: 'done' | 'not_yet') {
    setTouched(true);
    if (!job || !stage || busy || (kind === 'done' && (amountError || cents === null))) return;
    setBusy(true);
    setFailure('');
    try {
      const next = await answerPractice(job.id, stage.id, kind === 'done' ? { kind, amountCents: cents ?? 0 } : { kind, note: note.trim() });
      setResult(next.stages.find((s) => s.id === stage.id)?.status ?? null);
    } catch (e) {
      setFailure(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <View style={styles.head}>
      <Tag label="Test: the client's page" tone="marigold" />
      <Text style={styles.brand}>Akayza · sign-off link, no app needed</Text>
    </View>
  );

  if (result) {
    const confirmed = result === 'confirmed';
    return (
      <Screen back footer={<Button title="Back to the job" onPress={() => router.back()} />}>
        {header}
        <Title>{result === 'photo_taken' ? `${business} will hear from you` : 'Thank you'}</Title>
        <InfoNote icon={confirmed ? 'check-circle' : 'info'} tone={confirmed ? 'ok' : 'info'}>
          {confirmed
            ? `The ${stage?.name} stage is now confirmed by both of you.`
            : result === 'amounts_dont_match'
              ? `Your amount and ${business}'s don't match. ${business} will contact you to sort it out.`
              : `${business} can see your note and will come back to you.`}
        </InfoNote>
        <Text style={styles.small}>On a real job the client sees only this, on their own phone. Go back to see what the builder sees.</Text>
      </Screen>
    );
  }

  return (
    <Screen
      back
      footer={
        stage ? (
          notYet ? (
            <>
              <Button title={`Send to ${business}`} onPress={() => answer('not_yet')} loading={busy} />
              <Button title="Back" variant="secondary" onPress={() => setNotYet(false)} disabled={busy} />
            </>
          ) : (
            <>
              <Button title={`Yes, the ${stage.name.toLowerCase()} is done`} icon="check" variant="accent" onPress={() => answer('done')} loading={busy} />
              <Button title={`Not yet: tell ${business} why`} variant="secondary" onPress={() => setNotYet(true)} disabled={busy} />
            </>
          )
        ) : null
      }>
      {header}
      {!job ? (
        failure ? <Text style={styles.failure}>{failure}</Text> : <ActivityIndicator color={colors.accent} />
      ) : stage ? (
        <>
          <Title>{business} asks you to sign off</Title>
          <Card style={{ gap: 6 }}>
            <Text style={styles.stage}>
              {stage.name} stage · {formatRand(stage.amountCents)}
            </Text>
            <Text style={styles.sub}>
              {job.title}, {job.clientName}
            </Text>
            {stage.photo ? <Image source={{ uri: stage.photo.uri }} style={styles.photo} accessibilityLabel={`${stage.name} photo`} /> : null}
            {stage.photo ? <Text style={styles.sub}>{stage.name} · photo taken in the app</Text> : null}
          </Card>
          {notYet ? (
            <TextField label="What still needs doing?" optional value={note} onChangeText={setNote} maxLength={NOTE_MAX} placeholder="The window frames aren't in yet" />
          ) : (
            <AmountField label="Cash you paid for this stage (if any)" value={amount} onChangeText={setAmount} error={touched ? amountError : ''} />
          )}
          <InfoNote icon="eye-off">
            You type your own amount. {business} doesn&apos;t see it until you both confirm. This link works once and expires in 7 days.
          </InfoNote>
          {failure ? <Text style={styles.failure}>{failure}</Text> : null}
        </>
      ) : (
        <Text style={styles.failure}>This link has already been used or has expired.</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: 6 },
  brand: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textMuted },
  stage: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  photo: { width: '100%', height: 180, borderRadius: 10, backgroundColor: colors.iconTile, marginTop: 6 },
  failure: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.garnet },
  small: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, textAlign: 'center' },
});
