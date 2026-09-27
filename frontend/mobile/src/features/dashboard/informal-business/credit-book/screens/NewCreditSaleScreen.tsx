import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useSession } from '@/features/auth/session/SessionProvider';
import { randomKey } from '@/features/dashboard/informal-business/order-book/lib/keys';
import { ApiError } from '@/shared/api/client';
import { isRetryable } from '@/shared/api/retryable';
import { Button } from '@/shared/components/Button';
import { Checkbox } from '@/shared/components/Choice';
import { Card, InfoNote } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Title } from '@/shared/components/Text';
import { TextField } from '@/shared/components/TextField';
import { formatRand } from '@/shared/lib/money';
import { colors, fonts } from '@/shared/theme/tokens';

import { creditBookApi } from '../api/creditBookApi';
import { keepForLater } from '../lib/pending';
import { AmountField } from '../components/AmountField';
import { CustomerField } from '../components/CustomerField';
import { CalendarSheet } from '../components/CalendarSheet';
import { Chip, DuePicker } from '../components/DuePicker';
import { amountError, DESCRIPTION_MAX, NAME_MAX, parseRand } from '../lib/amounts';
import { addDays, MAX_DAYS_BACK, nextFriday, shortDate, todayIso } from '../lib/dueDates';
import { normalisePhone, openWhatsApp, receiptText } from '../lib/whatsapp';
import { Customer } from '../types';

/**
 * New credit sale (PDF p3): who, how much, what, and when they pay back.
 * If the customer has a cellphone, the trader can send a WhatsApp receipt
 * from their own phone straight after saving.
 *
 * Copying the paper book: "Given on: Earlier" back-dates it (up to a year),
 * and the pay-back date may then already be past, so it shows as late.
 *
 * Other tools can start it filled in (the order book's "Pay later"):
 * ?amount=94&description=Order #12: ...&name=Thabo
 */
export default function NewCreditSaleScreen() {
  const { profile } = useSession();
  const start = useLocalSearchParams<{ amount?: string; description?: string; name?: string }>();
  const [today] = useState(todayIso());
  const [name, setName] = useState(start.name ?? '');
  const [picked, setPicked] = useState<Customer | null>(null);
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState(start.amount ?? '');
  const [description, setDescription] = useState(start.description ?? '');
  const [givenOn, setGivenOn] = useState(today);
  const [calendar, setCalendar] = useState(false);
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

  function giveOn(day: string) {
    setGivenOn(day);
    if (dueOn && dueOn < day) setDueOn(null);
    // A receipt is for credit given now, not for copying an old book.
    setReceipt(day === today);
  }

  function type(next: string) {
    setName(next);
    if (picked && next !== picked.name) setPicked(null);
  }

  // One key per sale: however often it's retried -- now or later from the phone's queue -- it lands once.
  const saleKey = useRef(randomKey());

  async function save() {
    setTouched(true);
    const cents = parseRand(amount);
    if (Object.values(errors).some(Boolean) || cents === null || !dueOn || saving) return;
    setSaving(true);
    setFailure('');
    const input = {
      customer: picked ? { id: picked.id } : { name: name.trim(), phone: typedPhone },
      amountCents: cents,
      description: description.trim(),
      givenOn,
      dueOn,
    };
    try {
      const entry = await creditBookApi.addSale(input, saleKey.current);
      if (receipt && whatsappTo) await openWhatsApp(whatsappTo, receiptText(entry, profile.businessName, today));
      router.dismissTo({ pathname: '/informal-business/credit-book', params: { saved: entry.id } });
    } catch (err) {
      // No signal: keep it on the phone; it goes (once) when the signal is back.
      const label = `${picked ? picked.name : name.trim()} · ${formatRand(cents)} credit`;
      if (isRetryable(err) && (await keepForLater({ key: saleKey.current, kind: 'sale', input, label, at: new Date().toISOString() }))) {
        router.dismissTo({ pathname: '/informal-business/credit-book', params: { waiting: '1' } });
        return;
      }
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
      <View style={{ gap: 8 }}>
        <Text style={styles.label}>Given on</Text>
        <View style={styles.chips}>
          <Chip label="Today" on={givenOn === today} onPress={() => giveOn(today)} />
          <Chip label={givenOn === today ? 'Earlier' : shortDate(givenOn, today)} on={givenOn !== today} onPress={() => setCalendar(true)} />
        </View>
        {givenOn !== today ? <Text style={styles.hint}>From your paper book? The pay-back date can be in the past too.</Text> : null}
      </View>
      <DuePicker value={dueOn} onChange={setDueOn} today={today} min={givenOn} error={e('dueOn')} />
      {calendar ? (
        <CalendarSheet
          onClose={() => setCalendar(false)}
          title="Given on"
          value={givenOn}
          min={addDays(today, -MAX_DAYS_BACK)}
          max={today}
          today={today}
          onPick={giveOn}
        />
      ) : null}

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
  label: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted },
  failure: { fontFamily: fonts.medium, fontSize: 13, color: colors.garnet, textAlign: 'center' },
});
