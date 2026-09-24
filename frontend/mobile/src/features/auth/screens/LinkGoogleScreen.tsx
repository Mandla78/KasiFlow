import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { IconTile, InfoNote } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Body, Title } from '@/shared/components/Text';
import { TextField } from '@/shared/components/TextField';
import { AuthError, authApi } from '@/features/auth/api/authApi';
import { useSession } from '@/features/auth/session/SessionProvider';
import { colors, fonts } from '@/shared/theme/tokens';

/** The Google email already has a password account: prove it once, then either way works. */
export default function LinkGoogle() {
  const { email = '' } = useLocalSearchParams<{ email: string }>();
  const { signedIn } = useSession();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function link() {
    setBusy(true);
    setError('');
    try {
      signedIn(await authApi.linkGoogle(email, password));
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen back footer={<Button title="Link Google" onPress={link} loading={busy} disabled={!password} />}>
      <View style={{ gap: 14 }}>
        <IconTile name="key" size={50} />
        <Title>You already have an account</Title>
        <Body>
          <Text style={styles.email}>{email}</Text> signed up with a password before. Enter it once to link Google, then
          either way works.
        </Body>
      </View>
      <TextField label="Password" password value={password} onChangeText={setPassword} error={error} autoFocus />
      <Pressable onPress={() => router.push({ pathname: '/forgot-password', params: { email } })}>
        <Text style={styles.link}>Forgot password?</Text>
      </Pressable>
      <InfoNote icon="shield">We never merge accounts silently. Linking needs proof that both are yours.</InfoNote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  email: { fontFamily: fonts.bold, color: colors.ink },
  link: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
});
