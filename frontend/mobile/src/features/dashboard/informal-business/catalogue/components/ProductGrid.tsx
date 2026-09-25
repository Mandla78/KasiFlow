import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { formatRand } from '@/shared/lib/money';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import type { Product } from '../types';
import { ProductImage } from './ProductImage';

const COLUMNS = 3;
const GAP = 8;
const SIDE_PADDING = 40; // the screen's 20 + 20

/** The supplier's products, three to a row: photo, name, pack, price, [+]. */
export function ProductGrid({
  products,
  quantityOf,
  onOpen,
  onAdd,
}: {
  products: Product[];
  quantityOf: (productId: string) => number;
  onOpen: (p: Product) => void;
  onAdd: (p: Product) => void;
}) {
  const { width } = useWindowDimensions();
  const cell = Math.floor((Math.min(width, 520) - SIDE_PADDING - GAP * (COLUMNS - 1)) / COLUMNS);

  return (
    <View style={styles.grid}>
      {products.map((p) => {
        const qty = quantityOf(p.id);
        const out = p.stock === 'out';
        return (
          <Pressable key={p.id} onPress={() => onOpen(p)} style={[styles.cell, { width: cell }]} accessibilityLabel={`${p.name}, ${formatRand(p.priceCents)}`}>
            <View>
              <View style={out && styles.dim}>
                <ProductImage url={p.images[0] ?? null} category={p.category} size={cell} />
              </View>
              {p.compareAtPriceCents && !out ? (
                <View style={styles.saleBadge}>
                  <Text style={styles.saleText}>Sale</Text>
                </View>
              ) : null}
              {out ? (
                <View style={styles.outBadge}>
                  <Text style={styles.outText}>Out of stock</Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => onAdd(p)}
                  hitSlop={6}
                  style={[styles.add, qty > 0 && styles.addOn]}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${p.name} to cart`}>
                  {qty > 0 ? <Text style={styles.qty}>{qty}</Text> : <Feather name="plus" size={16} color={colors.white} />}
                </Pressable>
              )}
            </View>
            <Text style={styles.name} numberOfLines={2}>
              {p.name}
            </Text>
            <Text style={styles.pack} numberOfLines={1}>
              {p.packSize}
            </Text>
            <Text style={[styles.price, p.compareAtPriceCents ? styles.salePrice : null]}>{formatRand(p.priceCents)}</Text>
            {p.compareAtPriceCents ? <Text style={styles.was}>{formatRand(p.compareAtPriceCents)}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  cell: { gap: 3, marginBottom: 6 },
  add: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addOn: { backgroundColor: colors.accent },
  qty: { fontFamily: fonts.bold, fontSize: 13, color: colors.white },
  dim: { opacity: 0.45 },
  saleBadge: { position: 'absolute', left: 6, top: 6, backgroundColor: colors.garnet, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 1 },
  saleText: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.white },
  salePrice: { color: colors.garnet },
  was: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted, textDecorationLine: 'line-through' },
  outBadge: { position: 'absolute', left: 6, bottom: 6, backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  outText: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.garnet },
  name: { fontFamily: fonts.semibold, fontSize: 12.5, lineHeight: 16, color: colors.text, marginTop: 4 },
  pack: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted },
  price: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
});
