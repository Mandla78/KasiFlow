import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { ApiError } from '@/shared/api/client';
import { Button } from '@/shared/components/Button';
import { TextField } from '@/shared/components/TextField';
import { colors, fonts } from '@/shared/theme/tokens';

import { creditBookApi } from '../api/creditBookApi';
import { normalisePhone } from '../lib/whatsapp';
import { Customer } from '../types';
import { Sheet } from './Sheet';

type Props = {
  customer: { id: string; name: string };
  onClose: () => void;
  onSaved: (customer: Customer) => void;
};

/**
 * Add a customer's cellphone after the fact, so the trader can send
 * WhatsApp reminders. Mount it only while open.
 */
export function PhoneSheet({ customer, onClose, onSaved }: Props) {
  const [phone, setPhone] = useState('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState('');
  const normalised = normalisePhone(phone);
  const error = !phone.trim() ? 'Type the cellphone number' : !normalised ? 'A cellphone number, like 082 123 4567' : '';

  async function save() {
    setTouched(true);
    if (!normalised || saving) return;
    setSaving(true);
    setFailure('');
    try {
      onSaved(await creditBookApi.setCustomerPhone(customer.id, normalised));
    } catch (e) {
      setFailure(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
      setSaving(false);
    }
  }

  return (
    <Sheet visible onClose={onClose} title={`${customer.name}'s cellphone`}>
      <TextField
        label="Cellphone"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder="082 123 4567"
        autoFocus
        hint="Only for WhatsApp receipts and reminders, sent by you."
        error={touched ? error : ''}
      />
      {failure ? <Text style={styles.failure}>{failure}</Text> : null}
      <Button title="Save cellphone" onPress={save} loading={saving} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  failure: { fontFamily: fonts.medium, fontSize: 13, color: colors.garnet },
});
