import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Parts';
import { colors, fonts } from '@/shared/theme/tokens';

import { creditBookApi } from '../api/creditBookApi';
import { dismissRefused, sendWaiting, usePending } from '../lib/pending';

/**
 * What's waiting on this phone to be sent (credit written with no signal).
 * It tries by itself every time the credit book opens and every time the
 * app comes back to the front; "Send now" tries at once. Anything the
 * server refused is shown once, with its reason.
 */
export function WaitingCard({ onSent }: { onSent: () => void }) {
  const { items, refused } = usePending();
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);

  const send = useCallback(async () => {
    setBusy(true);
    try {
      const r = await sendWaiting(creditBookApi);
      if (r) {
        setOffline(r.offline);
        if (r.sent) onSent();
      }
    } finally {
      setBusy(false);
    }
  }, [onSent]);

  useFocusEffect(
    useCallback(() => {
      send();
    }, [send]),
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && send());
    return () => sub.remove();
  }, [send]);

  if (!items.length && !refused.length) return null;
  const n = items.length;
  return (
    <Card style={styles.card}>
      {n ? (
        <>
          <View style={styles.row}>
            <Feather name="cloud-off" size={16} color={colors.marigoldDeep} />
            <Text style={styles.title}>{n === 1 ? '1 waiting to send' : `${n} waiting to send`} · saved on this phone</Text>
          </View>
          {items.slice(0, 5).map((p) => (
            <Text key={p.key} style={styles.item}>
              {p.label}
            </Text>
          ))}
          {n > 5 ? <Text style={styles.item}>and {n - 5} more</Text> : null}
          <Text style={styles.note}>
            {offline ? "Still no signal. They'll go by themselves when you're back online." : 'They go by themselves when the signal is back, each one once.'}
          </Text>
          <Button title="Send now" variant="secondary" compact loading={busy} onPress={send} />
        </>
      ) : null}
      {refused.length ? (
        <View style={{ gap: 6 }}>
          {refused.map((r) => (
            <Text key={r.item.key} style={styles.refused}>
              Not saved: {r.item.label}. {r.message}
            </Text>
          ))}
          <Pressable accessibilityRole="button" onPress={dismissRefused} hitSlop={8}>
            <Text style={styles.ok}>OK</Text>
          </Pressable>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, backgroundColor: colors.marigoldTint, borderColor: colors.marigoldTint },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: fonts.bold, fontSize: 14, color: colors.text, flexShrink: 1 },
  item: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.text },
  note: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, color: colors.textMuted },
  refused: { fontFamily: fonts.medium, fontSize: 13, color: colors.garnet },
  ok: { fontFamily: fonts.bold, fontSize: 13, color: colors.accent },
});
