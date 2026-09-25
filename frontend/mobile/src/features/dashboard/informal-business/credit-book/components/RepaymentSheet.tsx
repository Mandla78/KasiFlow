import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/shared/api/client';
import { Button } from '@/shared/components/Button';
import { formatRand } from '@/shared/lib/money';
import { colors, fonts } from '@/shared/theme/tokens';

import { creditBookApi } from '../api/creditBookApi';
import { amountError, centsToInput, parseRand } from '../lib/amounts';
import { addDays, shortDate } from '../lib/dueDates';
import { CreditEntry, CreditEntryDetail } from '../types';
import { AmountField } from './AmountField';
import { CalendarSheet } from './CalendarSheet';
import { Chip } from './DuePicker';
import { Sheet } from './Sheet';

type Props = {
  entry: CreditEntry;
  today: string;
  onClose: () => void;
  onSaved: (entry: CreditEntryDetail) => void;
};

/**
 * Record money paid back: all of it or part, today or an earlier day.
 * Mount it only while open, so every opening starts from a clean form.
 */
export function RepaymentSheet({ entry, today, onClose, onSaved }: Props) {
  const left = entry.outstandingCents;
  const [amount, setAmount] = useState(() => centsToInput(left));
  const [paidOn, setPaidOn] = useState(today);
  const [calendar, setCalendar] = useState(false);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState('');

  const error = amountError(amount, left, `Only ${formatRand(left)} is left to pay`);
  const cents = parseRand(amount);
  const yesterday = addDays(today, -1);
  const supplier = entry.kind === 'supplier_debt';

  async function save() {
    setTouched(true);
    if (error || cents === null || saving) return;
    setSaving(true);
    setFailure('');
    try {
      onSaved(await creditBookApi.recordRepayment(entry.id, { amountCents: cents, paidOn }));
    } catch (e) {
      setFailure(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet visible onClose={onClose} title={supplier ? 'Record a payment' : 'Record repayment'}>
      <Text style={styles.remaining}>
        {formatRand(left)} still {supplier ? 'to pay' : 'owed'}
      </Text>
      <AmountField
        label={supplier ? 'How much did you pay?' : 'How much did they pay back?'}
        value={amount}
        onChangeText={setAmount}
        error={touched ? error : ''}
      />
      <View style={styles.chips}>
        <Chip label={`All of it · ${formatRand(left)}`} on={cents === left} onPress={() => setAmount(centsToInput(left))} />
      </View>

      <View style={{ gap: 8 }}>
        <Text style={styles.label}>Paid on</Text>
        <View style={styles.chips}>
          <Chip label="Today" on={paidOn === today} onPress={() => setPaidOn(today)} />
          {yesterday >= entry.givenOn ? <Chip label="Yesterday" on={paidOn === yesterday} onPress={() => setPaidOn(yesterday)} /> : null}
          {entry.givenOn < yesterday ? (
            <Chip label={paidOn < yesterday ? shortDate(paidOn, today) : 'Earlier'} on={paidOn < yesterday} onPress={() => setCalendar(true)} />
          ) : null}
        </View>
      </View>

      {failure ? <Text style={styles.failure}>{failure}</Text> : null}
      <Button title={cents && !error ? `Save ${formatRand(cents)} paid back` : 'Save'} onPress={save} loading={saving} />
      <Text style={styles.note}>Saved as &ldquo;recorded by you&rdquo;. It can&apos;t be deleted later, only corrected.</Text>

      {calendar ? (
        <CalendarSheet onClose={() => setCalendar(false)} title="Paid on" value={paidOn} min={entry.givenOn} max={today} today={today} onPick={setPaidOn} />
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  remaining: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
  label: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  failure: { fontFamily: fonts.medium, fontSize: 13, color: colors.garnet },
  note: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, textAlign: 'center' },
});
