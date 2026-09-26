import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AuthError } from '@/features/auth/types';
import { Button } from '@/shared/components/Button';
import { Card, IconTile, ListRow, Tag } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Overline, Title } from '@/shared/components/Text';
import { colors, fonts } from '@/shared/theme/tokens';

import { securityApi, SignedInPhone } from '../api/securityApi';

function when(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
}

/** More -> Security: where you're signed in, your password, your data, your account. */
export default function SecurityScreen() {
  const [phones, setPhones] = useState<SignedInPhone[] | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    securityApi
      .phones()
      .then(setPhones)
      .catch((e) => setMessage(e instanceof AuthError ? e.message : "Couldn't load your phones."));
  }, []);
  useFocusEffect(load);

  const others = (phones ?? []).filter((p) => !p.this_phone).length;

  async function signOutOthers() {
    setBusy(true);
    try {
      const n = await securityApi.signOutOthers();
      setMessage(n ? `Signed out of ${n} other phone${n > 1 ? 's' : ''}.` : 'No other phones were signed in.');
      load();
    } catch (e) {
      setMessage(e instanceof AuthError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen back>
      <Title>Security</Title>

      <Overline>Where you&apos;re signed in</Overline>
      {!phones ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <Card style={{ gap: 12 }}>
          {phones.map((p) => (
            <View key={p.id} style={styles.phone}>
              <IconTile name="smartphone" size={36} />
              <View style={{ flex: 1 }}>
                <Text style={styles.phoneName}>{p.label || (p.platform === 'ios' ? 'iPhone' : 'Android phone')}</Text>
                <Text style={styles.phoneSub}>Last used {when(p.last_used_at)}</Text>
              </View>
              {p.this_phone ? <Tag label="This phone" tone="jade" /> : null}
            </View>
          ))}
          {others > 0 ? <Button title="Sign out other phones" variant="secondary" icon="log-out" onPress={signOutOthers} loading={busy} /> : null}
        </Card>
      )}

      {message ? (
        <View style={styles.note}>
          <Feather name="info" size={14} color={colors.ink} />
          <Text style={styles.noteText}>{message}</Text>
        </View>
      ) : null}

      <Overline>Password and data</Overline>
      <Card style={{ paddingVertical: 4 }}>
        <ListRow icon="key" title="Change password" subtitle="Your other phones will be signed out" onPress={() => router.push('/informal-business/security/change-password')} />
        <ListRow icon="user-x" title="Delete my account and data" subtitle="Coming soon" />
        <ListRow icon="trash-2" title="Close my account" subtitle="Ends every session on every phone" danger onPress={() => router.push('/informal-business/security/close-account')} last />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  phone: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  phoneName: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  phoneSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  note: { flexDirection: 'row', gap: 8, backgroundColor: colors.iconTile, borderRadius: 10, padding: 12 },
  noteText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.text },
});
