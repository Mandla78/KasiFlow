import { Feather } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { categoryByCode, CategoryCode, knownCategories } from '@/constants/categories';
import { colors, fonts, radius } from '@/shared/theme/tokens';

type IconName = ComponentProps<typeof Feather>['name'];

/** "All" + categories, each with its icon (the same icons as sign-up), one selected. */
export function CategoryChips({
  categories,
  value,
  onChange,
}: {
  categories: CategoryCode[];
  value: CategoryCode | 'all';
  onChange: (c: CategoryCode | 'all') => void;
}) {
  const chips: (CategoryCode | 'all')[] = ['all', ...knownCategories(categories)];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {chips.map((c) => {
        const on = value === c;
        const icon: IconName = c === 'all' ? 'grid' : (categoryByCode(c).icon as IconName);
        return (
          <Pressable key={c} onPress={() => onChange(c)} style={[styles.chip, on && styles.on]} accessibilityState={{ selected: on }}>
            <Feather name={icon} size={14} color={on ? colors.white : colors.ink} />
            <Text style={[styles.text, on && { color: colors.white }]}>{c === 'all' ? 'All' : categoryByCode(c).label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  on: { backgroundColor: colors.ink, borderColor: colors.ink },
  text: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
});
