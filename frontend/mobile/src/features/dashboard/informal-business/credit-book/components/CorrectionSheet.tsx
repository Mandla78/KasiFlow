import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/shared/api/client';
import { Button } from '@/shared/components/Button';
import { TextField } from '@/shared/components/TextField';
import { formatRand } from '@/shared/lib/money';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { creditBookApi } from '../api/creditBookApi';
import { amountError, centsToInput, DESCRIPTION_MAX, MAX_AMOUNT_CENTS, parseRand, REASON_MAX } from '../lib/amounts';
import { CreditEntry, CreditEntryDetail } from '../types';
import { AmountField } from './AmountField';
import { DuePicker } from './DuePicker';
import { Sheet } from './Sheet';

type Props = {
  entry: CreditEntry;
  today: string;
  onClose: () => void;
  onSaved: (entry: CreditEntryDetail) => void;
};

/**
 * "Correct this entry": new values go on top, the old ones stay in the
 * history. Nothing in the book is ever edited or deleted. An entry with no
 * repayments yet can be cancelled as a mistake instead.
 * Mount it only while open, so it always starts from the entry as it is.
 */
export function CorrectionSheet({ entry, today, onClose, onSaved }: Props) {
  const [amount, setAmount] = useState(() => centsToInput(entry.amountCents));
  const [description, setDescription] = useState(entry.description);
  const [dueOn, setDueOn] = useState<string | null>(entry.dueOn);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [saving, setSaving] = useState<'correct' | 'cancel' | null>(null);
  const [failure, setFailure] = useState('');

  const cents = parseRand(amount);
  const errors = {
    amount:
      amountError(amount, MAX_AMOUNT_CENTS) ||
      (cents !== null && cents < entry.paidCents ? `${formatRand(entry.paidCents)} was already paid back, so it can't be less than that` : ''),
    description: description.trim().length > DESCRIPTION_MAX ? `Keep it under ${DESCRIPTION_MAX} characters` : '',
    reason: reason.trim().length > REASON_MAX ? `Keep it under ${REASON_MAX} characters` : '',
  };
  const unchanged = cents === entry.amountCents && description.trim() === entry.description && dueOn === entry.dueOn;
  const e = (k: keyof typeof errors) => (touched ? errors[k] : '');

  async function run(kind: 'correct' | 'cancel', fn: () => Promise<CreditEntryDetail>) {
    if (saving) return;
    setSaving(kind);
    setFailure('');
    try {
      onSaved(await fn());
    } catch (err) {
      setFailure(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSaving(null);
    }
  }

  function save() {
    setTouched(true);
    if (Object.values(errors).some(Boolean) || cents === null || !dueOn) return;
    if (unchanged) return setFailure('Change the amount, the date or what they took first.');
    run('correct', () => creditBookApi.correct(entry.id, { amountCents: cents, dueOn, description: description.trim(), reason: reason.trim() }));
  }

  return (
    <Sheet visible onClose={onClose} title="Correct this entry">
      <Text style={styles.intro}>The old values stay in the history, so the book always adds up.</Text>
      <AmountField label="Amount" value={amount} onChangeText={setAmount} error={e('amount')} />
      <TextField
        label="What did they take?"
        optional
        value={description}
        onChangeText={setDescription}
        maxLength={DESCRIPTION_MAX}
        error={e('description')}
      />
      <DuePicker value={dueOn} onChange={setDueOn} today={today} min={entry.givenOn} />
      <TextField label="Why the change?" optional value={reason} onChangeText={setReason} maxLength={REASON_MAX} placeholder="e.g. Typed R84 instead of R48" error={e('reason')} />

      {failure ? <Text style={styles.failure}>{failure}</Text> : null}
      <Button title="Save correction" onPress={save} loading={saving === 'correct'} disabled={saving === 'cancel'} />

      {entry.paidCents === 0 ? (
        confirmCancel ? (
          <View style={styles.confirm}>
            <Text style={styles.confirmText}>Cancel this entry? It stops counting, but stays in the history as cancelled.</Text>
            <View style={styles.actions}>
              <Button compact variant="secondary" title="Keep it" onPress={() => setConfirmCancel(false)} />
              <Button
                compact
                variant="danger"
                title="Cancel entry"
                loading={saving === 'cancel'}
                onPress={() => run('cancel', () => creditBookApi.cancel(entry.id, reason.trim()))}
              />
            </View>
          </View>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => setConfirmCancel(true)} style={styles.cancelLink}>
            <Text style={styles.cancelText}>Entered by mistake? Cancel this entry</Text>
          </Pressable>
        )
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  intro: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted },
  failure: { fontFamily: fonts.medium, fontSize: 13, color: colors.garnet },
  cancelLink: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { fontFamily: fonts.bold, fontSize: 14, color: colors.garnet },
  confirm: { gap: 10, backgroundColor: colors.garnetTint, borderRadius: radius.sm, padding: 12 },
  confirmText: { fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, color: colors.text },
  actions: { flexDirection: 'row', gap: 10 },
});
