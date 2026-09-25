import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { Card, IconTile, ListRow } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Title } from '@/shared/components/Text';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { BIN_READY, creditBookApi } from '../api/creditBookApi';
import { EntryRow } from '../components/EntryRow';
import { NAME_MAX } from '../lib/amounts';
import { todayIso } from '../lib/dueDates';
import { CreditEntry } from '../types';

/** Credit book history: what's finished (paid back, cancelled), newest first, searchable by name. */
export default function HistoryScreen() {
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<CreditEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Search as you type, with a short pause between searches.
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      creditBookApi
        .history(query)
        .then((rows) => {
          if (!live) return;
          setEntries(rows);
          setFailed(false);
        })
        .catch(() => live && setFailed(true));
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, attempt]);
  // Coming back from an entry or the bin: refresh.
  useFocusEffect(useCallback(() => setAttempt((n) => n + 1), []));

  const today = todayIso();

  return (
    <Screen back>
      <Title>History</Title>
      <View style={styles.search}>
        <Feather name="search" size={16} color={colors.textMuted} />
        <TextInput
          accessibilityLabel="Search by customer"
          value={query}
          onChangeText={setQuery}
          placeholder="Search by customer"
          placeholderTextColor={colors.textFaint}
          maxLength={NAME_MAX}
          style={styles.searchInput}
        />
      </View>

      {failed ? (
        <Card style={styles.center}>
          <IconTile name="wifi-off" size={44} />
          <Text style={styles.muted}>Couldn&apos;t open your history. Check your connection and try again.</Text>
          <Button title="Try again" variant="secondary" onPress={() => setAttempt((n) => n + 1)} />
        </Card>
      ) : !entries ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : entries.length === 0 ? (
        <Card style={styles.center}>
          <IconTile name="clock" size={44} />
          <Text style={styles.muted}>{query.trim() ? `No one called "${query.trim()}" in your history.` : 'Nothing finished yet. Entries paid back or cancelled show here.'}</Text>
        </Card>
      ) : (
        <Card style={{ paddingVertical: 0 }}>
          {entries.map((e, i) => (
            <EntryRow
              key={e.id}
              entry={e}
              today={today}
              onPress={() => router.push({ pathname: '/informal-business/credit-book/[id]', params: { id: e.id } })}
              last={i === entries.length - 1}
            />
          ))}
        </Card>
      )}

      {BIN_READY ? (
        <Card style={{ paddingVertical: 4 }}>
          <ListRow icon="trash-2" title="Bin" subtitle="What you deleted in the last 30 days" onPress={() => router.push('/informal-business/credit-book/bin')} last />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, height: '100%', fontFamily: fonts.medium, fontSize: 14.5, color: colors.text, outlineWidth: 0 },
  loading: { paddingVertical: 40, alignItems: 'center' },
  center: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  muted: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted, textAlign: 'center' },
});
