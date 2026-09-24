import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { Screen } from '@/shared/components/Screen';
import { Body, Muted, Title } from '@/shared/components/Text';
import { TextField } from '@/shared/components/TextField';
import { isEmail } from '@/shared/lib/validation';
import { authApi } from '@/features/auth/api/authApi';

export default function ForgotPassword() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  async function send() {
    setTouched(true);
    if (!isEmail(email)) return;
    setBusy(true);
    await authApi.requestPasswordReset(email.trim().toLowerCase());
    setBusy(false);
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
        error={touched && !isEmail(email) ? 'Enter a valid email address' : ''}
      />
      <Muted>For your safety we say the same thing whether or not the email has an account.</Muted>
    </Screen>
  );
}
