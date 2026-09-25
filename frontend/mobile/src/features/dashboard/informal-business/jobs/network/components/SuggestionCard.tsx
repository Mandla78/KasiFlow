import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SupplierAvatar } from '@/features/dashboard/informal-business/suppliers/components/SupplierAvatar';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { kmText } from '../lib/recommend';
import { tradesText } from '../lib/trades';
import type { BuilderCard } from '../types';
import { BuilderConnectButton } from './BuilderConnectButton';

export const SUGGESTION_WIDTH = 196;

/** One builder in the "Builders you may know" row you swipe: who, where, why, Connect. */
export function SuggestionCard({ builder, busy, onOpen, onConnect }: { builder: BuilderCard; busy?: boolean; onOpen: () => void; onConnect: () => void }) {
  return (
    <View style={styles.card}>
      {/* The card opens the profile; Connect sits outside it (no button inside a button). */}
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${builder.name}`} onPress={onOpen} style={({ pressed }) => [styles.open, pressed && { opacity: 0.8 }]}>
        <SupplierAvatar name={builder.name} initials={builder.initials} color={builder.color} logoUrl={builder.photoUrl} size={60} />
        <View style={{ alignItems: 'center', gap: 3 }}>
          <Text style={styles.name} numberOfLines={1}>
            {builder.name}
          </Text>
          <Text style={styles.where} numberOfLines={1}>
            {tradesText(builder.trades)} · {builder.suburb} · {kmText(builder.distanceKm)}
          </Text>
        </View>
        <Text style={styles.reason} numberOfLines={2}>
          {builder.reason}
        </Text>
      </Pressable>
      <BuilderConnectButton name={builder.name} state={builder.connection} busy={busy} onPress={onConnect} />
    </View>
  );
}

const styles = StyleSheet.create({
  open: { alignItems: 'center', gap: 10, alignSelf: 'stretch' },
  card: {
    width: SUGGESTION_WIDTH,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    alignItems: 'center',
    gap: 10,
  },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, maxWidth: SUGGESTION_WIDTH - 28 },
  where: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, maxWidth: SUGGESTION_WIDTH - 28 },
  reason: { fontFamily: fonts.semibold, fontSize: 12.5, lineHeight: 17, color: colors.accentDeep, textAlign: 'center', minHeight: 34 },
});
