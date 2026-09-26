import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { Card, ToggleRow } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Title } from '@/shared/components/Text';
import { colors, fonts } from '@/shared/theme/tokens';

import { notificationsApi } from '../api/notificationsApi';
import type { NotificationSettings, NotificationSettingsInput } from '../types';

/**
 * Which alerts you get (More -> Notifications). Security alerts can't be
 * switched off: a new phone or a changed password is always worth knowing.
 * Each switch saves at once; if the server says no, it flips back.
 */
export default function NotificationSettingsScreen() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [failure, setFailure] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    notificationsApi
      .settings()
      .then((s) => live && setSettings(s))
      .catch(() => live && setFailure("Couldn't load your settings. Check your connection."));
    return () => {
      live = false;
    };
  }, [attempt]);

  const retry = () => {
    setFailure('');
    setAttempt((a) => a + 1);
  };

  async function change(key: keyof NotificationSettingsInput, on: boolean) {
    if (!settings) return;
    const before = settings;
    const next = { orders: settings.orders, jobs: settings.jobs, credit: settings.credit, [key]: on };
    setSettings({ ...settings, [key]: on });
    setFailure('');
    try {
      setSettings(await notificationsApi.saveSettings(next));
    } catch {
      setSettings(before);
      setFailure("Couldn't save that. Try again.");
    }
  }

  return (
    <Screen back>
      <Title>Notifications</Title>
      <Text style={styles.intro}>Choose what we tell you about. Alerts show in the app; nothing is sent to anyone else.</Text>
      {failure ? <Text style={styles.failure}>{failure}</Text> : null}
      {!settings ? (
        failure ? (
          <Button title="Try again" variant="secondary" onPress={retry} />
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )
      ) : (
        <Card style={{ paddingVertical: 4 }}>
          <ToggleRow icon="package" title="Orders" subtitle="Your supplier orders as they move" value={settings.orders} onChange={(on) => change('orders', on)} />
          <ToggleRow icon="tool" title="Jobs and partners" subtitle="Client sign-offs, invites, payments between builders" value={settings.jobs} onChange={(on) => change('jobs', on)} />
          <ToggleRow icon="book" title="Credit book reminders" subtitle="Who pays you back today" value={settings.credit} onChange={(on) => change('credit', on)} />
          <ToggleRow icon="shield" title="Security" subtitle="Always on for your safety" value locked />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted },
  failure: { fontFamily: fonts.medium, fontSize: 13, color: colors.garnet },
  loading: { paddingVertical: 40, alignItems: 'center' },
});
