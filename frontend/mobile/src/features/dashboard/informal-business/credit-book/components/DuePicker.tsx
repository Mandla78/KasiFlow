import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '@/shared/theme/tokens';

import { addDays, monthEnd, nextFriday, shortDate } from '../lib/dueDates';
import { CalendarSheet } from './CalendarSheet';

/** A year ahead is the furthest a pay-back date can go (the server says the same). */
export const MAX_DUE_DAYS = 366;

type Props = {
  label?: string;
  value: string | null;
  onChange: (iso: string) => void;
  today: string;
  /** Earliest allowed day; today for a new entry, the day it was given for a correction. */
  min?: string;
  error?: string;
};

/** "Pays back on": the three dates people actually use, or any day from a calendar. */
export function DuePicker({ label = 'Pays back on', value, onChange, today, min = today, error }: Props) {
  const [calendar, setCalendar] = useState(false);
  const quick = [
    { key: 'today', label: 'Today', iso: today },
    { key: 'friday', label: 'Friday', iso: nextFriday(today) },
    { key: 'month', label: 'Month-end', iso: monthEnd(today) },
  ].filter((q) => q.iso >= min);
  const picked = value !== null && !quick.some((q) => q.iso === value);

  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        {quick.map((q) => (
          <Chip key={q.key} label={q.label} on={value === q.iso} onPress={() => onChange(q.iso)} />
        ))}
        <Chip label={picked && value ? shortDate(value, today) : 'Pick date'} on={picked} onPress={() => setCalendar(true)} />
      </View>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : value ? (
        <Text style={styles.hint}>{value === today ? `Today, ${shortDate(value, today)}` : shortDate(value, today)}</Text>
      ) : null}
      {calendar ? (
        <CalendarSheet
          onClose={() => setCalendar(false)}
          title={label}
          value={value}
          min={min}
          max={addDays(today, MAX_DUE_DAYS)}
          today={today}
          onPick={onChange}
        />
      ) : null}
    </View>
  );
}

export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipText, on && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink },
  hint: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted },
  error: { fontFamily: fonts.body, fontSize: 12, color: colors.garnet },
});
