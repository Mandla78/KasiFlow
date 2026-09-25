import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { categoryByCode, CategoryCode } from '@/constants/categories';
import { colors, fonts, radius } from '@/shared/theme/tokens';

/** "All" + the supplier's categories, one selected. */
export function CategoryChips({
  categories,
  value,
  onChange,
}: {
  categories: CategoryCode[];
  value: CategoryCode | 'all';
  onChange: (c: CategoryCode | 'all') => void;
}) {
  const chips: (CategoryCode | 'all')[] = ['all', ...categories];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {chips.map((c) => (
        <Pressable key={c} onPress={() => onChange(c)} style={[styles.chip, value === c && styles.on]} accessibilityState={{ selected: value === c }}>
          <Text style={[styles.text, value === c && { color: colors.white }]}>{c === 'all' ? 'All' : categoryByCode(c).label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 16, height: 38, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, justifyContent: 'center' },
  on: { backgroundColor: colors.ink, borderColor: colors.ink },
  text: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
});
