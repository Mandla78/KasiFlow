import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useSession } from '@/features/auth/session/SessionProvider';
import { AuthError } from '@/features/auth/types';
import { Button } from '@/shared/components/Button';
import { Screen } from '@/shared/components/Screen';
import { Title } from '@/shared/components/Text';
import { TextField } from '@/shared/components/TextField';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { securityApi } from '../api/securityApi';

const WHAT_HAPPENS = [
  'You are signed out on every phone, and this phone’s security key is switched off.',
  'You can’t sign in to this account again.',
  'Your personal information is removed, except records the law requires us to keep (see the Privacy Policy).',
];

/** Password required: closing an account can't be done by someone who just picked up the phone. */
export default function CloseAccountScreen() {
  const { signOut } = useSession();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function close() {
    if (!password) return setError('Enter your password to confirm.');
    setBusy(true);
    setError('');
    try {
      await securityApi.closeAccount(password);
      signOut(); // the session is already ended on the server
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Something went wrong. Try again.');
      setBusy(false);
    }
  }

  return (
    <Screen back footer={<Button title="Close my account" variant="danger" onPress={close} loading={busy} />}>
      <Title>Close my account</Title>
      <View style={styles.box}>
        {WHAT_HAPPENS.map((w) => (
          <View key={w} style={styles.row}>
            <Feather name="alert-circle" size={15} color={colors.garnet} style={{ marginTop: 2 }} />
            <Text style={styles.text}>{w}</Text>
          </View>
        ))}
      </View>
      <TextField label="Your password" password value={password} onChangeText={setPassword} autoComplete="current-password" error={error} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.garnetTint, borderRadius: radius.md, padding: 14, gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  text: { flex: 1, fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, color: colors.text },
});
