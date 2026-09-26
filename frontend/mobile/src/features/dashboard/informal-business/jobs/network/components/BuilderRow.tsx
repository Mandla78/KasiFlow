import { Feather } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { SupplierAvatar } from '@/features/dashboard/informal-business/suppliers/components/SupplierAvatar';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { kmText } from '../lib/recommend';
import { tradesText } from '../lib/trades';
import type { BuilderCard } from '../types';

/**
 * A builder in a list, led by their work: the cover photo of their best
 * build (their initials until they have one), then who and where, and the
 * reason we show them. `right` holds an action (Invite, WhatsApp...).
 */
export function BuilderRow({ builder, right, onOpen, last }: { builder: BuilderCard; right?: ReactNode; onOpen: () => void; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rule]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${builder.name}`} onPress={onOpen} style={({ pressed }) => [styles.who, pressed && { opacity: 0.8 }]}>
        {builder.cover ? (
          <View>
            <Image source={builder.cover} style={styles.cover} />
            <View style={styles.badge}>
              <SupplierAvatar name={builder.name} initials={builder.initials} color={builder.color} logoUrl={builder.photoUrl} size={26} />
            </View>
          </View>
        ) : (
          <View style={styles.noCover}>
            <SupplierAvatar name={builder.name} initials={builder.initials} color={builder.color} logoUrl={builder.photoUrl} size={48} />
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.name} numberOfLines={1}>
            {builder.name}
          </Text>
          <Text style={styles.detail} numberOfLines={1}>
            {tradesText(builder.trades)} · {builder.suburb} · {kmText(builder.distanceKm)}
          </Text>
          <Text style={styles.reason} numberOfLines={1}>
            {builder.reason}
          </Text>
        </View>
      </Pressable>
      {right ?? <Feather name="chevron-right" size={18} color={colors.textFaint} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  rule: { borderBottomWidth: 1, borderBottomColor: colors.line },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
  cover: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.line },
  badge: { position: 'absolute', right: -6, bottom: -6, borderRadius: 15, borderWidth: 2, borderColor: colors.white },
  noCover: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.iconTile, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  detail: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  reason: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.accentDeep },
});
