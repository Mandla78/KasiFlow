import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { AmountField } from '@/features/dashboard/informal-business/credit-book/components/AmountField';
import { parseRand } from '@/features/dashboard/informal-business/credit-book/lib/amounts';
import { normalisePhone } from '@/features/dashboard/informal-business/credit-book/lib/whatsapp';
import { ApiError } from '@/shared/api/client';
import { Button } from '@/shared/components/Button';
import { InfoNote } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Title } from '@/shared/components/Text';
import { TextField } from '@/shared/components/TextField';
import { colors, fonts } from '@/shared/theme/tokens';

import { jobsApi } from '../api/jobsApi';
import { DraftStage, StageEditor } from '../components/StageEditor';
import { CLIENT_NAME_MAX, MAX_JOB_CENTS, PLACE_MAX, STAGE_NAME_MAX, STARTER_STAGES, stagesTotal, TITLE_MAX } from '../lib/stages';

const hasLetter = (s: string) => /\p{L}/u.test(s);

/**
 * New job: what it is, the client (their cellphone is where the sign-off
 * link goes), where, the total, and the stages that add up to it.
 */
export default function NewJobScreen() {
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [place, setPlace] = useState('');
  const [total, setTotal] = useState('');
  const [stages, setStages] = useState<DraftStage[]>(() => STARTER_STAGES.map((name, i) => ({ key: `s${i}`, name, amount: '' })));
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState('');

  const totalCents = parseRand(total);
  const stageCents = stages.map((s) => parseRand(s.amount));
  const errors = {
    title: !hasLetter(title) ? 'Say what the job is, like "Room extension"' : title.trim().length > TITLE_MAX ? `Use at most ${TITLE_MAX} characters` : '',
    clientName: !hasLetter(clientName) ? "Type the client's name" : clientName.trim().length > CLIENT_NAME_MAX ? `Use at most ${CLIENT_NAME_MAX} characters` : '',
    clientPhone: !normalisePhone(clientPhone) ? 'A cellphone number, like 082 123 4567' : '',
    place: place.trim().length > PLACE_MAX ? `Use at most ${PLACE_MAX} characters` : '',
    total: !total.trim() ? 'Type the total price' : totalCents === null || totalCents <= 0 ? 'Type an amount like 38000' : totalCents > MAX_JOB_CENTS ? 'The most is R5,000,000' : '',
    stages: stages.some((s) => !hasLetter(s.name) || s.name.trim().length > STAGE_NAME_MAX)
      ? 'Give every stage a name'
      : stageCents.some((c) => c === null || c <= 0)
        ? 'Give every stage an amount'
        : totalCents && stagesTotal(stageCents.map((c) => ({ amountCents: c ?? 0 }))) !== totalCents
          ? 'The stages must add up to the total'
          : '',
  };
  const e = (k: keyof typeof errors) => (touched ? errors[k] : '');

  async function save() {
    setTouched(true);
    if (Object.values(errors).some(Boolean) || totalCents === null || saving) return;
    setSaving(true);
    setFailure('');
    try {
      const job = await jobsApi.create({
        title: title.trim(),
        clientName: clientName.trim(),
        clientPhone: normalisePhone(clientPhone) ?? '',
        place: place.trim(),
        totalCents,
        stages: stages.map((s, i) => ({ name: s.name.trim(), amountCents: stageCents[i] ?? 0 })),
      });
      router.replace({ pathname: '/informal-business/jobs/[id]', params: { id: job.id } });
    } catch (err) {
      // Keep everything typed; just say what to do.
      setFailure(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
      setSaving(false);
    }
  }

  return (
    <Screen
      back
      footer={
        <>
          {failure ? <Text style={styles.failure}>{failure}</Text> : null}
          <Button title="Save job" onPress={save} loading={saving} />
        </>
      }>
      <Title>New job</Title>
      <TextField label="What's the job?" value={title} onChangeText={setTitle} placeholder="Room extension" maxLength={TITLE_MAX} error={e('title')} />
      <TextField label="Client" value={clientName} onChangeText={setClientName} autoCapitalize="words" placeholder="Mokoena family" maxLength={CLIENT_NAME_MAX} error={e('clientName')} />
      <TextField
        label="Client's cellphone"
        value={clientPhone}
        onChangeText={setClientPhone}
        keyboardType="phone-pad"
        placeholder="082 123 4567"
        hint="The sign-off link goes here, from your WhatsApp."
        error={e('clientPhone')}
      />
      <TextField label="Where" optional value={place} onChangeText={setPlace} placeholder="Tembisa, Ext 5" maxLength={PLACE_MAX} error={e('place')} />
      <AmountField label="Total price" value={total} onChangeText={setTotal} error={e('total')} />
      <StageEditor stages={stages} onChange={setStages} totalCents={totalCents} error={e('stages')} />
      <InfoNote icon="lock">The client&apos;s name and number stay private to you. They only get the sign-off links you send.</InfoNote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  failure: { fontFamily: fonts.medium, fontSize: 13, color: colors.garnet, textAlign: 'center' },
});
