import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { AmountField } from '@/features/dashboard/informal-business/credit-book/components/AmountField';
import { parseRand, centsToInput } from '@/features/dashboard/informal-business/credit-book/lib/amounts';
import { ApiError } from '@/shared/api/client';
import { Button } from '@/shared/components/Button';
import { InfoNote } from '@/shared/components/Parts';
import { Sheet } from '@/shared/components/Sheet';
import { Cents } from '@/shared/lib/money';
import { colors, fonts } from '@/shared/theme/tokens';

import { MAX_OFFER_CENTS } from '../lib/pay';

/**
 * Cash between partners, recorded by both: "I paid Thabo R4,500" on the
 * owner's side, "I got R4,500" on the partner's. The same amount from both
 * confirms it; different amounts are both kept. Mount while open.
 */
export function PaySheet({
  title,
  intro,
  label,
  startCents,
  confirmLabel,
  onClose,
  onSave,
}: {
  title: string;
  intro: string;
  label: string;
  startCents: Cents;
  confirmLabel: string;
  onClose: () => void;
  onSave: (cents: Cents) => Promise<void>;
}) {
  const [amount, setAmount] = useState(startCents > 0 ? centsToInput(startCents) : '');
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState('');
  const cents = amount.trim() === '' ? null : parseRand(amount);
  const error = cents === null ? 'Type an amount like 4500' : cents > MAX_OFFER_CENTS ? 'That amount is too big' : '';

  async function save() {
    if (error || cents === null || saving) return;
    setSaving(true);
    setFailure('');
    try {
      await onSave(cents);
    } catch (e) {
      setFailure(e instanceof ApiError ? e.message : "Couldn't save it. Try again.");
      setSaving(false);
    }
  }

  return (
    <Sheet visible onClose={onClose}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{intro}</Text>
      <AmountField label={label} value={amount} onChangeText={setAmount} error={amount.trim() ? error : undefined} />
      {failure ? <InfoNote icon="alert-circle">{failure}</InfoNote> : null}
      <Button title={confirmLabel} loading={saving} disabled={!!error} onPress={save} />
      <Button title="Cancel" variant="secondary" onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 19, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.text },
});
