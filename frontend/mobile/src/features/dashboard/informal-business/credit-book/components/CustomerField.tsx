/**
 * "Customer": type a name. People the trader already has come up as you
 * type (tap one to use them); anything else becomes a new customer. With
 * the field empty, the trader's customers show as quick picks.
 */
import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TextField } from '@/shared/components/TextField';
import { formatRand } from '@/shared/lib/money';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { creditBookApi } from '../api/creditBookApi';
import { NAME_MAX } from '../lib/amounts';
import { formatPhone } from '../lib/whatsapp';
import { Customer } from '../types';

type Props = {
  name: string;
  picked: Customer | null;
  onType: (name: string) => void;
  onPick: (c: Customer) => void;
  error?: string;
};

export function CustomerField({ name, picked, onType, onPick, error }: Props) {
  const [matches, setMatches] = useState<Customer[]>([]);
  const query = picked ? '' : name.trim();

  useEffect(() => {
    if (picked) return;
    let live = true;
    // A short pause so we don't search on every key press.
    const timer = setTimeout(() => {
      creditBookApi
        .customers(query)
        .then((found) => live && setMatches(found))
        .catch(() => live && setMatches([]));
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, picked]);

  const shown = matches.slice(0, query ? 4 : 6);

  return (
    <View style={{ gap: 8 }}>
      <TextField
        label="Customer"
        value={name}
        onChangeText={onType}
        autoCapitalize="words"
        placeholder="Name or nickname"
        maxLength={NAME_MAX}
        ok={!!picked}
        error={error}
      />
      {picked ? (
        <Text style={styles.picked}>
          Existing customer{picked.phone ? ` · ${formatPhone(picked.phone)}` : ''}
          {picked.owesCents > 0 ? ` · already owes ${formatRand(picked.owesCents)}` : ''}
        </Text>
      ) : !query && shown.length ? (
        <View style={styles.chips}>
          {shown.map((c) => (
            <Pressable key={c.id} accessibilityRole="button" onPress={() => onPick(c)} style={styles.chip}>
              <Text style={styles.chipText}>{c.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : shown.length ? (
        <View style={styles.list}>
          {shown.map((c, i) => (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              accessibilityLabel={`Use ${c.name}`}
              onPress={() => onPick(c)}
              style={({ pressed }) => [styles.row, i < shown.length - 1 && styles.rule, pressed && { opacity: 0.7 }]}>
              <Feather name="user" size={15} color={colors.ink} />
              <Text style={styles.rowName}>{c.name}</Text>
              <Text style={styles.rowSub}>{c.owesCents > 0 ? `owes ${formatRand(c.owesCents)}` : 'owes nothing'}</Text>
            </Pressable>
          ))}
        </View>
      ) : query ? (
        <Text style={styles.picked}>New customer</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  picked: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    justifyContent: 'center',
  },
  chipText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  list: { borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46 },
  rule: { borderBottomWidth: 1, borderBottomColor: colors.line },
  rowName: { flex: 1, fontFamily: fonts.semibold, fontSize: 14.5, color: colors.text },
  rowSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted },
});
