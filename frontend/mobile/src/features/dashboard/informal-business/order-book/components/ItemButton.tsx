import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatRand } from '@/shared/lib/money';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import type { MenuItem } from '../types';

/**
 * A menu item as a big button: tap to add, tap again for one more. The
 * count shows in the corner; the minus (beside it, not inside) takes one off.
 */
export function ItemButton({ item, qty, onAdd, onRemove }: { item: MenuItem; qty: number; onAdd: () => void; onRemove: () => void }) {
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${formatRand(item.priceCents)}${qty ? `, ${qty} in the order` : ''}`}
        onPress={onAdd}
        style={({ pressed }) => [styles.button, qty > 0 && styles.picked, pressed && { opacity: 0.8 }]}>
        <Text style={[styles.name, qty > 0 && styles.onDark]} numberOfLines={3}>
          {item.name}
        </Text>
        <Text style={[styles.price, qty > 0 && styles.onDark]}>{formatRand(item.priceCents)}</Text>
      </Pressable>
      {qty > 0 ? (
        <>
          <View style={styles.qty} pointerEvents="none">
            <Text style={styles.qtyText}>{qty}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`One less ${item.name}`} hitSlop={6} onPress={onRemove} style={styles.minus}>
            <Feather name="minus" size={18} color={colors.ink} />
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '48.5%' },
  button: {
    minHeight: 96,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
    padding: 12,
    justifyContent: 'space-between',
    gap: 6,
  },
  picked: { backgroundColor: colors.ink, borderColor: colors.ink },
  name: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 19, color: colors.text, paddingRight: 26 },
  price: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  onDark: { color: colors.white },
  qty: { position: 'absolute', top: 8, right: 8, minWidth: 28, height: 28, borderRadius: 14, backgroundColor: colors.marigold, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  qtyText: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.ink },
  minus: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
