import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useSession } from '@/features/auth/session/SessionProvider';
import { ApiError } from '@/shared/api/client';
import { Button } from '@/shared/components/Button';
import { Checkbox } from '@/shared/components/Choice';
import { Card, InfoNote } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Title } from '@/shared/components/Text';
import { TextField } from '@/shared/components/TextField';
import { colors, fonts } from '@/shared/theme/tokens';

import { creditBookApi } from '../api/creditBookApi';
import { AmountField } from '../components/AmountField';
import { CustomerField } from '../components/CustomerField';
import { DuePicker } from '../components/DuePicker';
import { amountError, DESCRIPTION_MAX, NAME_MAX, parseRand } from '../lib/amounts';
import { nextFriday, todayIso } from '../lib/dueDates';
import { normalisePhone, openWhatsApp, receiptText } from '../lib/whatsapp';
import { Customer } from '../types';

/**
 * New credit sale (PDF p3): who, how much, what, and when they pay back.
 * If the customer has a cellphone, the trader can send a WhatsApp receipt
 * from their own phone straight after saving.
 */
export default function NewCreditSaleScreen() {
  const { profile } = useSession();
  const [today] = useState(todayIso());
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<Customer | null>(null);
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [dueOn, setDueOn] = useState<string | null>(nextFriday(today));
  const [receipt, setReceipt] = useState(true);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState('');

  const typedPhone = phone.trim() ? normalisePhone(phone) : null;
  const errors = {
    name: !name.trim() ? "Type the customer's name" : name.trim().length > NAME_MAX ? `Keep it under ${NAME_MAX} characters` : '',
    phone: !picked && phone.trim() && !typedPhone ? 'A cellphone number, like 082 123 4567' : '',
    amount: amountError(amount),
    description: description.trim().length > DESCRIPTION_MAX ? `Keep it under ${DESCRIPTION_MAX} characters` : '',
    dueOn: !dueOn ? 'Choose when they pay back' : '',
  };
  const e = (k: keyof typeof errors) => (touched ? errors[k] : '');
  const whatsappTo = picked ? picked.phone : typedPhone;
  const firstName = name.trim().split(/\s+/)[0] || 'them';

  function type(next: string) {
    setName(next);
    if (picked && next !== picked.name) setPicked(null);
  }

  async function save() {
    setTouched(true);
    const cents = parseRand(amount);
    if (Object.values(errors).some(Boolean) || cents === null || !dueOn || saving) return;
    setSaving(true);
    setFailure('');
    try {
      const entry = await creditBookApi.addSale({
        customer: picked ? { id: picked.id } : { name: name.trim(), phone: typedPhone },
        amountCents: cents,
        description: description.trim(),
        dueOn,
      });
      if (receipt && whatsappTo) await openWhatsApp(whatsappTo, receiptText(entry, profile.businessName, today));
      router.dismissTo({ pathname: '/informal-business/credit-book', params: { saved: entry.id } });
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
          <Button title="Save credit sale" onPress={save} loading={saving} />
        </>
      }>
      <Title>New credit sale</Title>
      <CustomerField
        name={name}
        picked={picked}
        onType={type}
        onPick={(c) => {
          setPicked(c);
          setName(c.name);
          setFailure('');
        }}
        error={e('name')}
      />
      {!picked && name.trim() ? (
        <TextField
          label="Cellphone"
          optional
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="082 123 4567"
          hint="Only for WhatsApp receipts and reminders, sent by you."
          error={e('phone')}
        />
      ) : null}
      <AmountField label="Amount" value={amount} onChangeText={setAmount} error={e('amount')} />
      <TextField
        label="What did they take?"
        optional
        value={description}
        onChangeText={setDescription}
        placeholder="Bread and milk"
        maxLength={DESCRIPTION_MAX}
        error={e('description')}
      />
      <DuePicker value={dueOn} onChange={setDueOn} today={today} error={e('dueOn')} />

      {whatsappTo ? (
        <Card>
          <Checkbox checked={receipt} onChange={setReceipt} label={`Send ${firstName} a receipt on WhatsApp`}>
            <Text style={styles.check}>Send {firstName} a receipt on WhatsApp</Text>
          </Checkbox>
        </Card>
      ) : null}

      <InfoNote icon="lock">Customer names stay private to you.</InfoNote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  check: { fontFamily: fonts.medium, fontSize: 14.5, lineHeight: 22, color: colors.text },
  failure: { fontFamily: fonts.medium, fontSize: 13, color: colors.garnet, textAlign: 'center' },
});
