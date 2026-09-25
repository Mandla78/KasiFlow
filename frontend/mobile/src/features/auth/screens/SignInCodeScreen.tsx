import { Feather } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthError, authApi } from '@/features/auth/api/authApi';
import { getPendingSignIn, setPendingSignIn } from '@/features/auth/session/pendingSignIn';
import { useSession } from '@/features/auth/session/SessionProvider';
import { Button } from '@/shared/components/Button';
import { CODE_LENGTH, CodeInput, CodeInputHandle } from '@/shared/components/CodeInput';
import { IconTile } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Body, Title } from '@/shared/components/Text';
import { colors, fonts } from '@/shared/theme/tokens';

const RESEND_AFTER = 45;

/** Two-factor, step two on a new phone: the code we emailed. */
export default function SignInCodeScreen() {
  const { signedIn } = useSession();
  const [pending] = useState(getPendingSignIn);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(RESEND_AFTER);
  const input = useRef<CodeInputHandle>(null);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  // Opened without a sign-in in progress (e.g. app restarted): start over.
  if (!pending) return <Redirect href="/sign-in" />;

  async function verify() {
    if (!pending || code.length !== CODE_LENGTH) return;
    setBusy(true);
    setError('');
    try {
      const profile = await authApi.verifySignIn(pending.email, pending.challenge, code);
      setPendingSignIn(null);
      signedIn(profile);
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Something went wrong. Try again.');
      setCode('');
      input.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!pending) return;
    try {
      await authApi.resendSignInCode(pending.challenge);
    } catch {
      // Same screen either way; the limit message isn't worth a detour.
    }
    setSeconds(RESEND_AFTER);
  }

  return (
    <Screen back footer={<Button title="Sign in" onPress={verify} loading={busy} disabled={code.length !== CODE_LENGTH} />}>
      <View style={{ gap: 14 }}>
        <IconTile name="shield" size={50} />
        <Title>Check your email</Title>
        <Body>
          This phone is new to your account. We sent a 6-digit code to <Text style={styles.email}>{pending.email}</Text>.
        </Body>
      </View>

      <CodeInput
        ref={input}
        value={code}
        label="Sign-in code"
        onChange={(c) => {
          setCode(c);
          setError('');
        }}
        error={!!error}
      />
      {error ? (
        <View style={{ gap: 6 }}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={[styles.small, styles.link]}>Sign in again</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.resendRow}>
        <Feather name="clock" size={13} color={colors.textMuted} />
        {seconds > 0 ? (
          <Text style={styles.small}>Resend in 0:{seconds.toString().padStart(2, '0')}</Text>
        ) : (
          <Pressable onPress={resend}>
            <Text style={[styles.small, styles.link]}>Resend code</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.small}>Can&apos;t see it? Check Spam or Promotions.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  email: { fontFamily: fonts.bold, color: colors.ink },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.garnet },
  resendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  small: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted },
  link: { textDecorationLine: 'underline', color: colors.ink },
});
