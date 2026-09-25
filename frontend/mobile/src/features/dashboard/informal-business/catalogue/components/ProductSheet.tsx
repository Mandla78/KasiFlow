import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { formatRand } from '@/shared/lib/money';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { STOCK_LABEL } from '../lib/format';
import type { Product } from '../types';
import { ProductImage } from './ProductImage';

/** One product: photos (swipe, 1-7), details, quantity, "Add to cart".
 *  Give it key={product.id} so each product opens with fresh state. */
export function ProductSheet({
  product,
  inCart,
  onClose,
  onSetQuantity,
}: {
  product: Product | null;
  inCart: number;
  onClose: () => void;
  onSetQuantity: (p: Product, qty: number) => void;
}) {
  const { width } = useWindowDimensions();
  const [qty, setQty] = useState(inCart || product?.minQty || 1);
  const [photo, setPhoto] = useState(0);

  if (!product) return null;
  const p = product;
  const imageSize = Math.min(width, 520) - 40;
  const out = p.stock === 'out';
  const clamp = (n: number) => Math.max(p.minQty, Math.min(p.maxQty, n));

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setPhoto(Math.round(e.nativeEvent.contentOffset.x / imageSize))}>
            {p.images.map((url, i) => (
              <View key={i} style={{ width: imageSize, alignItems: 'center' }}>
                <ProductImage url={url} category={p.category} size={imageSize * 0.6} />
              </View>
            ))}
          </ScrollView>
          {p.images.length > 1 ? (
            <View style={styles.dots}>
              {p.images.map((_, i) => (
                <View key={i} style={[styles.dot, i === photo && styles.dotOn]} />
              ))}
            </View>
          ) : null}

          <View style={{ gap: 4 }}>
            <Text style={styles.brand}>{p.brand}</Text>
            <Text style={styles.name}>{p.name}</Text>
            <Text style={styles.pack}>
              {p.packSize} · per {p.unit}
            </Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatRand(p.priceCents)}</Text>
            <Text style={styles.vat}>{p.vatIncluded ? 'incl. VAT' : 'excl. VAT'}</Text>
            <Text style={[styles.stock, out && { color: colors.garnet }, p.stock === 'low' && { color: colors.marigoldDeep }]}>{STOCK_LABEL[p.stock]}</Text>
          </View>
          <Text style={styles.description}>{p.description}</Text>

          {!out ? (
            <View style={styles.stepper}>
              <Pressable onPress={() => setQty(clamp(qty - 1))} style={styles.step} accessibilityLabel="Fewer">
                <Feather name="minus" size={18} color={colors.ink} />
              </Pressable>
              <Text style={styles.qty}>{qty}</Text>
              <Pressable onPress={() => setQty(clamp(qty + 1))} style={styles.step} accessibilityLabel="More">
                <Feather name="plus" size={18} color={colors.ink} />
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
        {out ? (
          <Button title="Out of stock" onPress={onClose} variant="secondary" disabled />
        ) : (
          <Button
            title={inCart ? `Update cart · ${formatRand(p.priceCents * qty)}` : `Add to cart · ${formatRand(p.priceCents * qty)}`}
            onPress={() => {
              onSetQuantity(p, qty);
              onClose();
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.35)' },
  sheet: { backgroundColor: colors.porcelain, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, gap: 12, maxHeight: '88%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.line },
  dotOn: { backgroundColor: colors.ink },
  brand: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textMuted },
  name: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  pack: { fontFamily: fonts.body, fontSize: 13.5, color: colors.textMuted },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  price: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  vat: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  stock: { marginLeft: 'auto', fontFamily: fonts.bold, fontSize: 12.5, color: colors.accentDeep },
  description: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.text },
  stepper: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 22, paddingVertical: 4 },
  step: { width: 44, height: 44, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  qty: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, minWidth: 30, textAlign: 'center' },
});
