import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '@/shared/theme/tokens';

import type { SupplierMatch } from '../types';

/** A matched supplier: who, how far, why it was picked, and Add / Added. */
export function SupplierCard({ match, added, onToggle, best }: { match: SupplierMatch; added: boolean; onToggle: () => void; best?: boolean }) {
  return (
    <View style={[styles.card, added && styles.cardOn]}>
      <View style={styles.row}>
        <View style={[styles.logo, { backgroundColor: match.color }]}>
          <Text style={styles.logoText}>{match.initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{match.name}</Text>
            {best ? <Text style={styles.best}>Best match</Text> : null}
          </View>
          <Text style={styles.muted}>
            {match.area} · {match.distanceKm.toFixed(1)} km
          </Text>
        </View>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: added }}
          accessibilityLabel={added ? `Remove ${match.name} from your suppliers` : `Add ${match.name} to your suppliers`}
          onPress={onToggle}
          hitSlop={6}
          style={[styles.add, added && styles.addOn]}>
          <Feather name={added ? 'check' : 'plus'} size={16} color={added ? colors.white : colors.ink} />
          <Text style={[styles.addText, added && { color: colors.white }]}>{added ? 'Added' : 'Add'}</Text>
        </Pressable>
      </View>
      <View style={styles.reasons}>
        {match.reasons.map((r) => (
          <View key={r} style={styles.reason}>
            <Feather name="check" size={14} color={colors.accentDeep} />
            <Text style={styles.reasonText}>{r}</Text>
          </View>
        ))}
        {match.caution ? (
          <View style={styles.reason}>
            <Feather name="alert-circle" size={14} color={colors.marigoldDeep} />
            <Text style={[styles.reasonText, { color: colors.marigoldDeep }]}>{match.caution}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 4 },
  cardOn: { borderColor: colors.accent, borderWidth: 1.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 46, height: 46, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.white },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  muted: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  best: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.accentDeep,
    backgroundColor: colors.accentTint,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  addOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  addText: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  reasons: { gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line },
  reason: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  reasonText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.text },
});
