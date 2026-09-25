import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '@/shared/theme/tokens';

/** − 3 + ; minus on 1 becomes a bin (remove). */
export function QuantityStepper({ value, max, onChange }: { value: number; max: number; onChange: (n: number) => void }) {
  return (
    <View style={styles.row}>
      <Pressable onPress={() => onChange(value - 1)} style={styles.step} accessibilityLabel={value === 1 ? 'Remove' : 'Fewer'}>
        <Feather name={value === 1 ? 'trash-2' : 'minus'} size={15} color={value === 1 ? colors.garnet : colors.ink} />
      </Pressable>
      <Text style={styles.qty}>{value}</Text>
      <Pressable onPress={() => onChange(Math.min(max, value + 1))} style={[styles.step, value >= max && { opacity: 0.4 }]} disabled={value >= max} accessibilityLabel="More">
        <Feather name="plus" size={15} color={colors.ink} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  step: { width: 34, height: 34, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  qty: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink, minWidth: 20, textAlign: 'center' },
});
