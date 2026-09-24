import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthError } from '@/features/auth/types';
import { Button } from '@/shared/components/Button';
import { Screen } from '@/shared/components/Screen';
import { Body, Title } from '@/shared/components/Text';
import { TextField } from '@/shared/components/TextField';
import { isStrongPassword } from '@/shared/lib/validation';
import { colors, fonts } from '@/shared/theme/tokens';

import { securityApi } from '../api/securityApi';

/** Needs the current password; signs out every other phone. */
export default function ChangePasswordScreen() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  const errors = {
    current: !current ? 'Enter your current password' : '',
    next: !isStrongPassword(next) ? 'Use 8 to 64 characters with a capital letter, a small letter, a number and a special character.' : '',
    confirm: confirm !== next ? "Passwords don't match" : '',
  };

  async function save() {
    setTouched(true);
    if (errors.current || errors.next || errors.confirm) return;
    setBusy(true);
    setError('');
    try {
      setDone(await securityApi.changePassword(current, next));
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (done !== null) {
    return (
      <Screen footer={<Button title="Done" onPress={() => router.back()} />}>
        <View style={{ gap: 8, paddingTop: 60 }}>
          <Title>Password changed</Title>
          <Body>{done ? `We signed you out of ${done} other phone${done > 1 ? 's' : ''}.` : 'You stay signed in on this phone.'}</Body>
        </View>
      </Screen>
    );
  }

  return (
    <Screen back footer={<Button title="Change password" onPress={save} loading={busy} />}>
      <Title>Change password</Title>
      <TextField label="Current password" password value={current} onChangeText={setCurrent} autoComplete="current-password" error={touched ? errors.current : ''} />
      <TextField label="New password" password value={next} onChangeText={setNext} autoComplete="new-password" error={touched ? errors.next : ''} />
      <TextField label="Confirm new password" password value={confirm} onChangeText={setConfirm} error={touched ? errors.confirm : ''} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.garnet },
});
