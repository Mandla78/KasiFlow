import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { Screen } from '@/shared/components/Screen';
import { Body, Title } from '@/shared/components/Text';
import { TextField } from '@/shared/components/TextField';
import { isEmail } from '@/shared/lib/validation';
import { AuthError, authApi } from '@/features/auth/api/authApi';

export default function ForgotPassword() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');

  async function send() {
    setTouched(true);
    if (!isEmail(email)) return;
    setBusy(true);
    setError('');
    try {
      await authApi.requestPasswordReset(email.trim().toLowerCase());
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Something went wrong. Try again.');
      return;
    } finally {
      setBusy(false);
    }
    router.replace({ pathname: '/reset-sent', params: { email: email.trim() } });
  }

  return (
    <Screen back footer={<Button title="Send reset link" onPress={send} loading={busy} />}>
      <View style={{ gap: 8 }}>
        <Title>Reset your password</Title>
        <Body>Enter your email and we&apos;ll send a link to choose a new password.</Body>
      </View>
      <TextField
        label="Email address"
        icon="mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoFocus
        error={touched && !isEmail(email) ? 'Enter a valid email address' : error}
      />
    </Screen>
  );
}
