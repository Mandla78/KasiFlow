import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '@/shared/theme/tokens';

import { CreditKind } from '../types';

const TABS: { kind: CreditKind; label: string }[] = [
  { kind: 'customer_debt', label: 'Customers owe me' },
  { kind: 'supplier_debt', label: 'I owe suppliers' },
];

/** The two sides of the book, as a segmented switch. */
export function CreditTabs({ value, onChange }: { value: CreditKind; onChange: (k: CreditKind) => void }) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {TABS.map((t) => {
        const on = t.kind === value;
        return (
          <Pressable
            key={t.kind}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(t.kind)}
            style={[styles.tab, on && styles.tabOn]}>
            <Text style={[styles.label, on && styles.labelOn]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', backgroundColor: colors.iconTile, borderRadius: radius.md, padding: 4, gap: 4 },
  tab: { flex: 1, height: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  tabOn: {
    backgroundColor: colors.white,
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textMuted },
  labelOn: { fontFamily: fonts.bold, color: colors.ink },
});
