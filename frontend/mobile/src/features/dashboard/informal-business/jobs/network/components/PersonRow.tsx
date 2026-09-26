import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SupplierAvatar } from '@/features/dashboard/informal-business/suppliers/components/SupplierAvatar';
import { colors, fonts } from '@/shared/theme/tokens';

import { kmText } from '../lib/recommend';
import { tradesText } from '../lib/trades';
import type { BuilderCard } from '../types';

/**
 * A builder as a row: photo, name, trade and where; tap to open their
 * profile. `right` holds the action (WhatsApp + Call, Accept, Pick...).
 */
export function PersonRow({ builder, line, right, onOpen, last }: { builder: BuilderCard; line?: string; right?: ReactNode; onOpen: () => void; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rule]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${builder.name}`} onPress={onOpen} style={styles.who}>
        <SupplierAvatar name={builder.name} initials={builder.initials} color={builder.color} logoUrl={builder.photoUrl} size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.name} numberOfLines={1}>
            {builder.name}
          </Text>
          <Text style={styles.detail} numberOfLines={1}>
            {line ?? `${tradesText(builder.trades)} · ${builder.suburb} · ${kmText(builder.distanceKm)}`}
          </Text>
        </View>
      </Pressable>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  rule: { borderBottomWidth: 1, borderBottomColor: colors.line },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  detail: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
});
