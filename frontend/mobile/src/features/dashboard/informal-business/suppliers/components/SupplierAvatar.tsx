import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/shared/theme/tokens';

/** The supplier's logo in a circle; their initials until a logo is uploaded. */
export function SupplierAvatar({ name, initials, color, logoUrl, size = 48 }: { name: string; initials: string; color: string; logoUrl: string | null; size?: number }) {
  const round = { width: size, height: size, borderRadius: size / 2 };
  if (logoUrl) return <Image source={{ uri: logoUrl }} style={[round, styles.photo]} accessibilityLabel={`${name} logo`} />;
  return (
    <View style={[round, styles.initials, { backgroundColor: color }]}>
      <Text style={[styles.text, { fontSize: Math.round(size * 0.34) }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { backgroundColor: colors.line },
  initials: { alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: fonts.extrabold, color: colors.white },
});
