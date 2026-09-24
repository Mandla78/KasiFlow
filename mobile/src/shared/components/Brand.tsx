/**
 * The Akayza mark and wordmark, drawn from assets/akayza-images/*.svg
 * so they stay crisp at any size.
 *
 * The K: a white pillar (trust), an emerald loop (goods flowing out), an
 * amber loop (cash coming back) and the node where they meet (the handshake).
 */
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { brand, fonts } from '@/shared/theme/tokens';

const TOP = 'M 64 150 C 90 150, 140 100, 180 50 C 205 20, 245 35, 235 70 C 220 120, 160 170, 110 180 Z';
const BOTTOM = 'M 100 160 C 145 175, 200 215, 225 255 C 240 280, 205 310, 175 290 C 135 260, 90 200, 64 185 Z';

/** The app-icon squircle with the K inside. */
export function BrandMark({ size = 56 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512">
      <Defs>
        <LinearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={brand.navy} />
          <Stop offset="1" stopColor={brand.slate} />
        </LinearGradient>
        <LinearGradient id="em" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={brand.emeraldLight} />
          <Stop offset="1" stopColor={brand.emeraldDeep} />
        </LinearGradient>
        <LinearGradient id="am" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor={brand.amber} />
          <Stop offset="1" stopColor={brand.amberLight} />
        </LinearGradient>
      </Defs>
      <Rect width="512" height="512" rx="112" fill="url(#bg)" />
      <Rect x="20" y="20" width="472" height="472" rx="96" fill="none" stroke="#334155" strokeWidth="3" opacity={0.6} />
      <Rect x="136" y="126" width="44" height="260" rx="22" fill={brand.white} />
      <Path d={TOP} fill="url(#em)" transform="translate(116 106)" />
      <Path d={BOTTOM} fill="url(#am)" transform="translate(116 106)" />
      <Circle cx="236" cy="276" r="22" fill={brand.emerald} stroke={brand.navy} strokeWidth="8" />
    </Svg>
  );
}

/** The wordmark from assets/akayza-images/akayza-svg.svg: "akay" + emerald "za". Pass onDark on navy backgrounds. */
export function Wordmark({ size = 26, onDark = false }: { size?: number; onDark?: boolean }) {
  return (
    <Text style={[styles.word, { fontSize: size, letterSpacing: -size * 0.03 }]}>
      <Text style={{ color: onDark ? brand.white : brand.navy }}>akay</Text>
      <Text style={{ color: brand.emerald }}>za</Text>
    </Text>
  );
}

export function BrandLockup({ onDark = false }: { onDark?: boolean }) {
  return (
    <View style={styles.lockup}>
      <BrandMark size={44} />
      <Wordmark size={26} onDark={onDark} />
    </View>
  );
}

const styles = StyleSheet.create({
  word: { fontFamily: fonts.extrabold },
  lockup: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
