import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/shared/theme/tokens';

import type { SupplierMatch } from '../types';
import { SupplierAvatar } from './SupplierAvatar';
import { VerifiedBadge } from './VerifiedBadge';

export const CIRCLE = 76;
const ITEM_WIDTH = 92;

/** A supplier in a sideways row: a big round photo, the name under it,
 *  how far. A green ring = you're connected (you can order from them). */
export function SupplierCircle({ match, connected, onOpen }: { match: SupplierMatch; connected: boolean; onOpen: () => void }) {
  const km = match.distanceKm < 10 ? match.distanceKm.toFixed(1) : match.distanceKm.toFixed(0);
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${match.name}, ${km} kilometres away${connected ? ', connected' : ''}`}
      style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}>
      <View style={[styles.ring, connected && styles.ringOn]}>
        <SupplierAvatar name={match.name} initials={match.initials} color={match.color} logoUrl={match.logoUrl} size={CIRCLE} />
      </View>
      <View style={styles.nameRow}>
        <Text style={styles.name} numberOfLines={2}>
          {match.name}
          {match.verified ? ' ' : ''}
        </Text>
        {match.verified ? <VerifiedBadge size={14} /> : null}
      </View>
      <Text style={styles.muted} numberOfLines={1}>
        {match.delivers ? `${km} km · delivers` : `${km} km`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { width: ITEM_WIDTH, alignItems: 'center', gap: 4 },
  ring: { padding: 3, borderRadius: (CIRCLE + 12) / 2, borderWidth: 2.5, borderColor: 'transparent' },
  ringOn: { borderColor: colors.jade },
  nameRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 2, marginTop: 2 },
  name: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 12.5, lineHeight: 16, color: colors.text, textAlign: 'center' },
  muted: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textMuted },
});
