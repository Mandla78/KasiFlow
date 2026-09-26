import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '@/shared/theme/tokens';

/** The bar under the title: [ For you | Jobs | Suppliers ]. Big targets, one selected. */
export function SegmentedTabs<T extends string>({ tabs, value, onChange }: { tabs: { key: T; label: string }[]; value: T; onChange: (t: T) => void }) {
  return (
    <View style={styles.bar} accessibilityRole="tablist">
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            aria-selected={on}
            onPress={() => onChange(t.key)}
            style={[styles.tab, on && styles.on]}>
            <Text style={[styles.label, on && styles.labelOn]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: colors.iconTile, borderRadius: radius.md, padding: 4, gap: 4 },
  tab: { flex: 1, minHeight: 42, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  on: { backgroundColor: colors.white, shadowColor: colors.ink, shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textMuted },
  labelOn: { fontFamily: fonts.bold, color: colors.ink },
});
