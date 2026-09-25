import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { ApiError } from '@/shared/api/client';
import { Button } from '@/shared/components/Button';
import { InfoNote } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Body, Title } from '@/shared/components/Text';
import { TextField } from '@/shared/components/TextField';
import { colors, fonts } from '@/shared/theme/tokens';

import { creditBookApi } from '../api/creditBookApi';
import { AmountField } from '../components/AmountField';
import { DuePicker } from '../components/DuePicker';
import { amountError, DESCRIPTION_MAX, parseRand, SUPPLIER_NAME_MAX } from '../lib/amounts';
import { monthEnd, todayIso } from '../lib/dueDates';

/**
 * "I owe suppliers": a debt the trader adds by hand (stock taken on
 * credit outside the app). Debts from orders in the app arrive on their
 * own later (suppliersOwedFromOrders).
 */
export default function AddSupplierDebtScreen() {
  const [today] = useState(todayIso());
  const [supplierName, setSupplierName] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [dueOn, setDueOn] = useState<string | null>(monthEnd(today));
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState('');

  const errors = {
    supplierName: !supplierName.trim()
      ? "Type the supplier's name"
      : supplierName.trim().length > SUPPLIER_NAME_MAX
        ? `Keep it under ${SUPPLIER_NAME_MAX} characters`
        : '',
    amount: amountError(amount),
    description: description.trim().length > DESCRIPTION_MAX ? `Keep it under ${DESCRIPTION_MAX} characters` : '',
    dueOn: !dueOn ? 'Choose when you pay' : '',
  };
  const e = (k: keyof typeof errors) => (touched ? errors[k] : '');

  async function save() {
    setTouched(true);
    const cents = parseRand(amount);
    if (Object.values(errors).some(Boolean) || cents === null || !dueOn || saving) return;
    setSaving(true);
    setFailure('');
    try {
      const entry = await creditBookApi.addSupplierDebt({ supplierName: supplierName.trim(), amountCents: cents, description: description.trim(), dueOn });
      router.dismissTo({ pathname: '/informal-business/credit-book', params: { tab: 'suppliers', saved: entry.id } });
    } catch (err) {
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
          <Button title="Save supplier debt" onPress={save} loading={saving} />
        </>
      }>
      <Title>Add supplier debt</Title>
      <Body>Stock a supplier gave you to pay later. Keep it here so nothing slips.</Body>
      <TextField
        label="Supplier"
        value={supplierName}
        onChangeText={setSupplierName}
        autoCapitalize="words"
        placeholder="Mahlangu Wholesale"
        maxLength={SUPPLIER_NAME_MAX}
        error={e('supplierName')}
      />
      <AmountField label="Amount you owe" value={amount} onChangeText={setAmount} error={e('amount')} />
      <TextField
        label="What was it for?"
        optional
        value={description}
        onChangeText={setDescription}
        placeholder="Cold drinks, 12 cases"
        maxLength={DESCRIPTION_MAX}
        error={e('description')}
      />
      <DuePicker label="You pay on" value={dueOn} onChange={setDueOn} today={today} error={e('dueOn')} />
      <InfoNote icon="info">Debts from orders you place in Akayza will show here by themselves.</InfoNote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  failure: { fontFamily: fonts.medium, fontSize: 13, color: colors.garnet, textAlign: 'center' },
});
