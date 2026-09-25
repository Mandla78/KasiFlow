import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatRand } from '@/shared/lib/money';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { estimatedTotal, itemCount, useCart } from '../lib/cartStore';

/** Pinned under a supplier's products once something is in the cart. */
export function CartBar({ supplierId, onOpen }: { supplierId: string; onOpen: () => void }) {
  const { lines } = useCart(supplierId);
  if (!lines.length) return null;
  const count = itemCount(lines);
  return (
    <Pressable onPress={onOpen} style={styles.bar} accessibilityRole="button" accessibilityLabel="View cart">
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{count}</Text>
      </View>
      <Text style={styles.text}>View cart</Text>
      <Text style={styles.total}>{formatRand(estimatedTotal(lines))}</Text>
      <Feather name="chevron-right" size={18} color={colors.white} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 54, borderRadius: radius.md, backgroundColor: colors.ink, paddingHorizontal: 16 },
  badge: { minWidth: 26, height: 26, borderRadius: 13, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { fontFamily: fonts.bold, fontSize: 13, color: colors.white },
  text: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.white },
  total: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
});
