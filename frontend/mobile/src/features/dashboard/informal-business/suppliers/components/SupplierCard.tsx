import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '@/shared/theme/tokens';

import type { SupplierMatch } from '../types';
import { ConnectButton } from './ConnectButton';
import { SupplierAvatar } from './SupplierAvatar';
import { VerifiedBadge } from './VerifiedBadge';

/** A supplier in a list: photo, name (with the verified tick), where, Connect.
 *  Why we suggest them lives on their page, not here. */
export function SupplierCard({
  match,
  connected,
  onConnect,
  onOpen,
}: {
  match: SupplierMatch;
  connected: boolean;
  onConnect: () => void;
  onOpen: () => void;
}) {
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Open ${match.name}`} style={styles.card}>
      <SupplierAvatar name={match.name} initials={match.initials} color={match.color} logoUrl={match.logoUrl} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {match.name}
          </Text>
          {match.verified ? <VerifiedBadge size={17} /> : null}
        </View>
        <Text style={styles.muted} numberOfLines={1}>
          {match.area} · {match.distanceKm < 10 ? match.distanceKm.toFixed(1) : match.distanceKm.toFixed(0)} km
        </Text>
      </View>
      <ConnectButton name={match.name} connected={connected} onPress={onConnect} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
});
