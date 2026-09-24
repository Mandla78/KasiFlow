import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import type { Registration } from '@/features/auth/types';
import { colors, fonts, radius } from '@/shared/theme/tokens';

type Cipc = NonNullable<Registration['cipc']>;

/**
 * The result of the backend's CIPC check, in plain words. "Verified" only
 * when the company is active AND the user is one of its directors: the
 * register is public, so a number alone proves nothing about who typed it.
 */
export function CipcStatusCard({ cipc, businessName }: { cipc: Cipc; businessName: string }) {
  const look = {
    pending: { icon: 'clock', color: colors.ink, bg: colors.iconTile, title: 'Checking with CIPC…' },
    verified: { icon: 'check-circle', color: colors.accentDeep, bg: colors.accentTint, title: 'Verified by CIPC' },
    owner_unconfirmed: { icon: 'user-x', color: colors.marigoldDeep, bg: colors.marigoldTint, title: 'Company found, owner not confirmed' },
    deregistered: { icon: 'alert-triangle', color: colors.garnet, bg: colors.garnetTint, title: 'Deregistered at CIPC' },
    not_found: { icon: 'help-circle', color: colors.marigoldDeep, bg: colors.marigoldTint, title: 'Not found at CIPC' },
    unavailable: { icon: 'refresh-cw', color: colors.ink, bg: colors.iconTile, title: "Couldn't reach CIPC" },
  } as const;
  const m = look[cipc.status];
  const body = {
    pending: `${cipc.number} · this usually takes a moment. You can keep using Akayza.`,
    verified: `Registered as ${cipc.registeredName}. Your trading name, ${businessName}, can differ.`,
    owner_unconfirmed: `${cipc.registeredName} is registered, but your name isn't on its list of directors. Upload your CIPC certificate (CoR 14.3) for a person to review.`,
    deregistered: `${cipc.registeredName} is deregistered, so we can't show a verified badge. You can still use Akayza.`,
    not_found: `We couldn't find ${cipc.number}. Check the number on your CIPC certificate.`,
    unavailable: "CIPC didn't answer. We'll try again automatically.",
  }[cipc.status];

  return (
    <View style={[styles.card, { backgroundColor: m.bg }]}>
      {cipc.status === 'pending' ? <ActivityIndicator color={m.color} /> : <Feather name={m.icon} size={18} color={m.color} />}
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: m.color }]}>{m.title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.md },
  title: { fontFamily: fonts.bold, fontSize: 14 },
  body: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.text, marginTop: 2 },
});
