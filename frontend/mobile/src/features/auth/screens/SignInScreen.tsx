import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { GoogleButton, InfoNote, OrDivider } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Body, Title } from '@/shared/components/Text';
import { TextField } from '@/shared/components/TextField';
import { isEmail } from '@/shared/lib/validation';
import { AuthError, authApi } from '@/features/auth/api/authApi';
import { useSession } from '@/features/auth/session/SessionProvider';
import { colors, fonts } from '@/shared/theme/tokens';

export default function SignIn() {
  const { signedIn, startEmailSignUp } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  async function submit() {
    if (!isEmail(email)) {
      setError('Enter a valid email address');
      return;
    }
    setBusy(true);
    setError('');
    try {
      signedIn(await authApi.signIn(email.trim().toLowerCase(), password));
    } catch (e) {
      if (e instanceof AuthError && e.code === 'EMAIL_NOT_VERIFIED') {
        // Right password, email never confirmed: the server just sent a new code.
        startEmailSignUp('', email.trim().toLowerCase());
        router.push('/verify-email');
        return;
      }
      setError(e instanceof AuthError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      back
      footer={
        <>
          <Button title="Sign in" onPress={submit} loading={busy} />
          <Pressable onPress={() => router.replace('/create-account')} style={styles.alt}>
            <Text style={styles.altText}>
              New here? <Text style={styles.altLink}>Create an account</Text>
            </Text>
          </Pressable>
        </>
      }>
      <View style={{ gap: 8 }}>
        <Title>Welcome back</Title>
        <Body>Sign in to your business.</Body>
      </View>
      <GoogleButton onPress={() => router.push('/google')} />
      <OrDivider />
      <TextField
        label="Email address"
        icon="mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        label="Password"
        password
        value={password}
        onChangeText={setPassword}
        autoComplete="current-password"
        returnKeyType="done"
        onSubmitEditing={submit}
        error={error}
      />
      <Pressable onPress={() => router.push({ pathname: '/forgot-password', params: { email } })}>
        <Text style={styles.link}>Forgot password?</Text>
      </Pressable>
      <InfoNote icon="smartphone">
        Signing in on a new phone switches off the old phone&apos;s key, so a lost phone can&apos;t confirm anything for you.
      </InfoNote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  alt: { alignItems: 'center', paddingVertical: 4 },
  altText: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  altLink: { fontFamily: fonts.bold, color: colors.ink },
});
