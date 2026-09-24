import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { IconTile, InfoNote } from '@/shared/components/Parts';
import { BackButton, Screen } from '@/shared/components/Screen';
import { Body, Title } from '@/shared/components/Text';
import { AuthError, authApi } from '@/features/auth/api/authApi';
import { useSession } from '@/features/auth/session/SessionProvider';
import { colors, fonts, radius } from '@/shared/theme/tokens';

const LENGTH = 6;
const RESEND_AFTER = 45;

/** Step 2 of 4: a 6-digit code by email. Nothing else happens until it's confirmed. */
export default function VerifyEmail() {
  const { profile, emailVerified, signOut } = useSession();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(RESEND_AFTER);
  const input = useRef<TextInput>(null);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  function wrongEmail() {
    // Start again with a different address.
    signOut();
    router.replace('/create-account');
  }

  async function verify() {
    if (code.length !== LENGTH) return;
    setBusy(true);
    setError('');
    try {
      await authApi.verifyEmail(profile.email, code);
      emailVerified(); // the router moves on to business type by itself
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Something went wrong. Try again.');
      setCode('');
      input.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    await authApi.resendCode(profile.email);
    setSeconds(RESEND_AFTER);
  }

  return (
    <Screen
      footer={
        <>
          <InfoNote icon="key">
            Once confirmed, Akayza creates a private key on this phone. It signs everything you confirm, so nobody can fake it.
          </InfoNote>
          <Button title="Verify email" onPress={verify} loading={busy} disabled={code.length !== LENGTH} />
        </>
      }>
      <BackButton onPress={wrongEmail} />
      <View style={{ gap: 14 }}>
        <IconTile name="mail" size={50} />
        <Title>Check your email</Title>
        <Body>
          We sent a 6-digit code to <Text style={styles.email}>{profile.email}</Text>. Enter it to confirm the address is yours.
        </Body>
      </View>

      <Pressable onPress={() => input.current?.focus()} style={styles.boxes} accessibilityLabel="Verification code">
        {Array.from({ length: LENGTH }).map((_, i) => {
          const active = i === Math.min(code.length, LENGTH - 1);
          return (
            <View key={i} style={[styles.box, active && styles.boxActive, !!error && styles.boxError]}>
              <Text style={styles.digit}>{code[i] ?? ''}</Text>
            </View>
          );
        })}
      </Pressable>
      <TextInput
        ref={input}
        value={code}
        onChangeText={(t) => {
          setCode(t.replace(/\D/g, '').slice(0, LENGTH));
          setError('');
        }}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={LENGTH}
        autoFocus
        style={styles.hidden}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.resendRow}>
        <Feather name="clock" size={13} color={colors.textMuted} />
        {seconds > 0 ? (
          <Text style={styles.small}>Resend in 0:{seconds.toString().padStart(2, '0')}</Text>
        ) : (
          <Pressable onPress={resend}>
            <Text style={[styles.small, styles.link]}>Resend code</Text>
          </Pressable>
        )}
        <Text style={styles.small}>·</Text>
        <Pressable onPress={wrongEmail}>
          <Text style={[styles.small, styles.link]}>Wrong email?</Text>
        </Pressable>
      </View>
      <Text style={styles.small}>Can&apos;t see it? Check Spam or Promotions.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  email: { fontFamily: fonts.bold, color: colors.ink },
  boxes: { flexDirection: 'row', gap: 8 },
  box: {
    flex: 1,
    height: 54,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: colors.ink, borderWidth: 1.5 },
  boxError: { borderColor: colors.garnet },
  digit: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  hidden: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.garnet },
  resendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  small: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted },
  link: { textDecorationLine: 'underline', color: colors.ink },
});
