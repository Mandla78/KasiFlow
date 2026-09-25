/**
 * Pick a day from a month grid. Plain views, no native date picker: it
 * works the same on every phone and in the web preview, and needs no new
 * phone build.
 */
import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '@/shared/theme/tokens';

import { fromIso, monthTitle, shortDate, toIso, WEEKDAY_INITIALS } from '../lib/dueDates';
import { Sheet } from './Sheet';

type Props = {
  onClose: () => void;
  title: string;
  value: string | null;
  /** First and last day that can be picked (ISO days). */
  min: string;
  max: string;
  today: string;
  onPick: (iso: string) => void;
};

/** Mount it only while open: it starts on the chosen day's month each time. */
export function CalendarSheet({ onClose, title, value, min, max, today, onPick }: Props) {
  const [month, setMonth] = useState(() => {
    const start = fromIso(value ?? (today < min ? min : today));
    return { y: start.getFullYear(), m: start.getMonth() };
  });

  const first = new Date(month.y, month.m, 1);
  const daysInMonth = new Date(month.y, month.m + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array<null>(first.getDay()).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => toIso(new Date(month.y, month.m, i + 1))),
  ];
  while (cells.length % 7) cells.push(null);

  const canBack = toIso(new Date(month.y, month.m, 0)) >= min;
  const canForward = toIso(new Date(month.y, month.m + 1, 1)) <= max;
  const shift = (by: number) => {
    const d = new Date(month.y, month.m + by, 1);
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
  };

  return (
    <Sheet visible onClose={onClose} title={title}>
      <View style={styles.head}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" disabled={!canBack} onPress={() => shift(-1)} style={[styles.nav, !canBack && styles.off]}>
          <Feather name="chevron-left" size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.month}>{monthTitle(month.y, month.m)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Next month" disabled={!canForward} onPress={() => shift(1)} style={[styles.nav, !canForward && styles.off]}>
          <Feather name="chevron-right" size={20} color={colors.ink} />
        </Pressable>
      </View>
      <View style={styles.grid}>
        {WEEKDAY_INITIALS.map((d, i) => (
          <Text key={`w${i}`} style={[styles.cell, styles.weekday]}>
            {d}
          </Text>
        ))}
        {cells.map((iso, i) => {
          if (!iso) return <View key={`e${i}`} style={styles.cell} />;
          const enabled = iso >= min && iso <= max;
          const selected = iso === value;
          return (
            <Pressable
              key={iso}
              accessibilityRole="button"
              accessibilityLabel={shortDate(iso, today)}
              accessibilityState={{ selected, disabled: !enabled }}
              disabled={!enabled}
              onPress={() => {
                onPick(iso);
                onClose();
              }}
              style={styles.cell}>
              <View style={[styles.day, iso === today && styles.today, selected && styles.selected]}>
                <Text style={[styles.dayText, !enabled && styles.dayOff, selected && { color: colors.white }]}>{fromIso(iso).getDate()}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nav: { width: 44, height: 44, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.3 },
  month: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: 46, alignItems: 'center', justifyContent: 'center' },
  weekday: { height: 28, textAlign: 'center', textAlignVertical: 'center', fontFamily: fonts.bold, fontSize: 12, color: colors.textMuted },
  day: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  today: { borderWidth: 1.5, borderColor: colors.ink },
  selected: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  dayOff: { color: colors.textFaint },
});
