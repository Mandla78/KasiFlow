import { Feather } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { categoryByCode, CategoryCode } from '@/constants/categories';
import { colors } from '@/shared/theme/tokens';

type IconName = ComponentProps<typeof Feather>['name'];

/** A product photo, or -- until the supplier's photos arrive -- the category icon on a soft tile. */
export function ProductImage({ url, category, size }: { url: string | null; category: CategoryCode; size: number }) {
  if (url) return <Image source={{ uri: url }} style={[styles.box, { width: size, height: size }]} resizeMode="cover" />;
  return (
    <View style={[styles.box, styles.placeholder, { width: size, height: size }]}>
      <Feather name={categoryByCode(category).icon as IconName} size={size * 0.34} color={colors.textMuted} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 12, overflow: 'hidden' },
  placeholder: { backgroundColor: colors.iconTile, alignItems: 'center', justifyContent: 'center' },
});
