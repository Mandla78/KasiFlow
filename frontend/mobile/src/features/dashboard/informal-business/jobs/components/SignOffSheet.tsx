import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useSession } from '@/features/auth/session/SessionProvider';
import { AmountField } from '@/features/dashboard/informal-business/credit-book/components/AmountField';
import { Sheet } from '@/features/dashboard/informal-business/credit-book/components/Sheet';
import { parseRand } from '@/features/dashboard/informal-business/credit-book/lib/amounts';
import { openWhatsApp } from '@/features/dashboard/informal-business/credit-book/lib/whatsapp';
import { ApiError } from '@/shared/api/client';
import { Button } from '@/shared/components/Button';
import { InfoNote } from '@/shared/components/Parts';
import { formatRand } from '@/shared/lib/money';
import { colors, fonts } from '@/shared/theme/tokens';

import { jobsApi } from '../api/jobsApi';
import { MAX_JOB_CENTS } from '../lib/stages';
import { Job, Stage } from '../types';

type Props = {
  job: Job;
  stage: Stage;
  onClose: () => void;
  onSent: (job: Job) => void;
};

/**
 * Send for sign-off (PDF p14, the builder's side): the cash the builder
 * received for this stage, then WhatsApp opens with the link for the
 * client. The client types their own amount; neither sees the other's
 * until both are in. Mount it only while open.
 */
export function SignOffSheet({ job, stage, onClose, onSent }: Props) {
  const { profile } = useSession();
  const [amount, setAmount] = useState('');
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState('');
  const cents = amount.trim() === '' ? null : parseRand(amount);
  const error =
    amount.trim() === '' ? 'Type the cash you received (0 if none yet)' : cents === null ? 'Type an amount like 12000' : cents > MAX_JOB_CENTS ? 'That amount is too big' : '';

  async function send() {
    setTouched(true);
    if (error || cents === null || sending) return;
    setSending(true);
    setFailure('');
    try {
      const sent = await jobsApi.sendSignOff(job.id, stage.id, cents, profile.businessName);
      const opened = await openWhatsApp(job.clientPhone, sent.message);
      if (!opened) setFailure("Couldn't open WhatsApp on this phone. The link is saved; try again.");
      onSent(sent.job);
    } catch (e) {
      setFailure(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
      setSending(false);
    }
  }

  return (
    <Sheet visible onClose={onClose} title={`Sign-off: ${stage.name}`}>
      <Text style={styles.intro}>
        {stage.name} stage · {formatRand(stage.amountCents)}
      </Text>
      <AmountField label="Cash the client gave you for this stage" value={amount} onChangeText={setAmount} error={touched ? error : ''} autoFocus />
      <InfoNote icon="eye-off">
        {job.clientName} types their own amount on the link. You don&apos;t see theirs, and they don&apos;t see yours, until both are in. If they match, the stage is confirmed by both.
      </InfoNote>
      {failure ? <Text style={styles.failure}>{failure}</Text> : null}
      <Button title={`Send to ${job.clientName} on WhatsApp`} icon="send" onPress={send} loading={sending} />
      <Text style={styles.small}>The link works once and expires in 7 days.</Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  intro: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
  failure: { fontFamily: fonts.medium, fontSize: 13, color: colors.garnet },
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, textAlign: 'center' },
});
