import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthError, authApi } from '@/features/auth/api/authApi';
import { Button } from '@/shared/components/Button';
import { Screen } from '@/shared/components/Screen';
import { Body, Title } from '@/shared/components/Text';
import { TextField } from '@/shared/components/TextField';
import { isStrongPassword } from '@/shared/lib/validation';
import { colors, fonts } from '@/shared/theme/tokens';

/**
 * Opened by the link in the reset email (akayza://reset-password?token=...).
 * The link works once and expires in 30 minutes; setting the new password
 * signs the account out everywhere.
 */
export default function ResetPasswordScreen() {
  const { token = '' } = useLocalSearchParams<{ token: string }>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const passwordError = !isStrongPassword(password)
    ? 'Use 8 to 64 characters with a capital letter, a small letter, a number and a special character.'
    : '';
  const confirmError = confirm !== password ? "Passwords don't match" : '';

  async function save() {
    setTouched(true);
    if (passwordError || confirmError) return;
    setBusy(true);
    setError('');
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Screen footer={<Button title="Sign in" onPress={() => router.replace('/sign-in')} />}>
        <View style={{ gap: 8, paddingTop: 60 }}>
          <Title>Password changed</Title>
          <Body>Sign in with your new password. You&apos;ve been signed out on every other phone.</Body>
        </View>
      </Screen>
    );
  }

  return (
    <Screen back footer={<Button title="Save new password" onPress={save} loading={busy} />}>
      <View style={{ gap: 8 }}>
        <Title>Choose a new password</Title>
        <Body>This link works once.</Body>
      </View>
      <TextField
        label="New password"
        password
        value={password}
        onChangeText={setPassword}
        autoComplete="new-password"
        error={touched ? passwordError : ''}
      />
      <TextField label="Confirm new password" password value={confirm} onChangeText={setConfirm} error={touched ? confirmError : ''} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.garnet },
});
