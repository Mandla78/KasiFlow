import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { Card, IconTile, ListRow, Tag } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Title } from '@/shared/components/Text';
import { formatRand } from '@/shared/lib/money';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { BIN_READY, jobsApi } from '../api/jobsApi';
import { TITLE_MAX } from '../lib/stages';
import { Job } from '../types';

/** Jobs history: finished jobs (every stage confirmed by both), newest first, searchable. */
export default function JobHistoryScreen() {
  const [query, setQuery] = useState('');
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Search as you type, with a short pause between searches.
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      jobsApi
        .history(query)
        .then((rows) => {
          if (!live) return;
          setJobs(rows);
          setFailed(false);
        })
        .catch(() => live && setFailed(true));
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, attempt]);
  useFocusEffect(useCallback(() => setAttempt((n) => n + 1), []));

  return (
    <Screen back>
      <Title>History</Title>
      <View style={styles.search}>
        <Feather name="search" size={16} color={colors.textMuted} />
        <TextInput
          accessibilityLabel="Search jobs"
          value={query}
          onChangeText={setQuery}
          placeholder="Search by job or client"
          placeholderTextColor={colors.textFaint}
          maxLength={TITLE_MAX}
          style={styles.searchInput}
        />
      </View>

      {failed ? (
        <Card style={styles.center}>
          <IconTile name="wifi-off" size={44} />
          <Text style={styles.muted}>Couldn&apos;t open your history. Check your connection and try again.</Text>
          <Button title="Try again" variant="secondary" onPress={() => setAttempt((n) => n + 1)} />
        </Card>
      ) : !jobs ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : jobs.length === 0 ? (
        <Card style={styles.center}>
          <IconTile name="clock" size={44} />
          <Text style={styles.muted}>{query.trim() ? `No job or client called "${query.trim()}".` : 'No finished jobs yet. A job lands here when every stage is confirmed by both.'}</Text>
        </Card>
      ) : (
        <Card style={{ paddingVertical: 0 }}>
          {jobs.map((j, i) => (
            <Pressable
              key={j.id}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/informal-business/jobs/[id]', params: { id: j.id } })}
              style={({ pressed }) => [styles.row, i < jobs.length - 1 && styles.rule, pressed && { opacity: 0.7 }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.name}>{j.title}</Text>
                <Text style={styles.detail}>{[j.clientName, j.place].filter(Boolean).join(' · ')}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 5 }}>
                <Text style={styles.amount}>{formatRand(j.totalCents)}</Text>
                <Tag label="Done" tone="jade" />
              </View>
            </Pressable>
          ))}
        </Card>
      )}

      {BIN_READY ? (
        <Card style={{ paddingVertical: 4 }}>
          <ListRow icon="trash-2" title="Bin" subtitle="Jobs you deleted in the last 30 days" onPress={() => router.push('/informal-business/jobs/bin')} last />
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, minHeight: 64 },
  rule: { borderBottomWidth: 1, borderBottomColor: colors.line },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  detail: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  amount: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.ink },
});
