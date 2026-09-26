/**
 * Small building blocks shared by many screens.
 */
import { FontAwesome, Feather } from '@expo/vector-icons';
import { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View, ViewStyle } from 'react-native';

import { colors, fonts, radius, sizes } from '@/shared/theme/tokens';

type IconName = ComponentProps<typeof Feather>['name'];

export function IconTile({
  name,
  tint = colors.iconTile,
  color = colors.ink,
  size = sizes.tile,
}: {
  name: IconName;
  tint?: string;
  color?: string;
  size?: number;
}) {
  return (
    <View style={[styles.tile, { backgroundColor: tint, width: size, height: size }]}>
      <Feather name={name} size={size * 0.45} color={color} />
    </View>
  );
}

/** Tinted note that says what's private, or what happens next. */
export function InfoNote({ icon = 'lock', children, tone = 'info' }: { icon?: IconName; children: ReactNode; tone?: 'info' | 'ok' }) {
  const ok = tone === 'ok';
  return (
    <View style={[styles.note, ok && { backgroundColor: colors.jadeTint }]}>
      <Feather name={icon} size={14} color={ok ? colors.jade : colors.ink} style={{ marginTop: 1 }} />
      <Text style={[styles.noteText, ok && { color: colors.jade }]}>{children}</Text>
    </View>
  );
}

export function OrDivider({ label = 'or with email' }: { label?: string }) {
  return (
    <View style={styles.divider}>
      <View style={styles.rule} />
      <Text style={styles.dividerText}>{label}</Text>
      <View style={styles.rule} />
    </View>
  );
}

export function GoogleButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.google, pressed && { opacity: 0.85 }]}>
      <FontAwesome name="google" size={17} color="#4285F4" />
      <Text style={styles.googleText}>Continue with Google</Text>
    </Pressable>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: ViewStyle; onPress?: () => void }) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, style, pressed && { opacity: 0.9 }]}>
      {children}
    </Pressable>
  );
}

/** Switch card: pick your tools. */
export function ToggleRow({
  icon,
  title,
  subtitle,
  value,
  onChange,
  locked,
  soon,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  value?: boolean;
  onChange?: (v: boolean) => void;
  locked?: boolean;
  soon?: boolean;
}) {
  return (
    <View style={[styles.card, styles.rowCard, soon && { opacity: 0.55 }]}>
      <IconTile name={icon} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{subtitle}</Text>
      </View>
      {soon ? (
        <Tag label="Soon" tone="muted" />
      ) : (
        <Switch
          value={value}
          onValueChange={onChange}
          disabled={locked}
          accessibilityLabel={title}
          trackColor={{ false: colors.line, true: locked ? colors.textFaint : colors.ink }}
          thumbColor={colors.white}
        />
      )}
    </View>
  );
}

type Tone = 'marigold' | 'jade' | 'info' | 'muted' | 'garnet';

export function Tag({ label, tone = 'info' }: { label: string; tone?: Tone }) {
  const t = tones[tone];
  return (
    <View style={[styles.tag, { backgroundColor: t.bg }]}>
      <Text style={[styles.tagText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const tones: Record<Tone, { bg: string; fg: string }> = {
  marigold: { bg: colors.marigoldTint, fg: colors.marigoldDeep },
  jade: { bg: colors.jadeTint, fg: colors.jade },
  info: { bg: colors.infoTint, fg: colors.ink },
  muted: { bg: colors.iconTile, fg: colors.textMuted },
  garnet: { bg: colors.garnetTint, fg: colors.garnet },
};

/** A tappable settings/list row inside a grouped card. */
export function ListRow({
  icon,
  title,
  subtitle,
  onPress,
  danger,
  last,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  return (
    // A row that opens nothing doesn't look tappable: no chevron, no press effect.
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.listRow, !last && styles.listRule, pressed && { opacity: 0.7 }]}>
      <IconTile
        name={icon}
        size={34}
        tint={danger ? colors.garnetTint : colors.iconTile}
        color={danger ? colors.garnet : colors.ink}
      />
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, danger && { color: colors.garnet }]}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      {onPress ? <Feather name="chevron-right" size={18} color={colors.textFaint} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  note: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.infoTint,
    borderRadius: radius.sm,
    padding: 12,
  },
  noteText: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 18, color: colors.ink },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rule: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerText: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  google: {
    height: sizes.button,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleText: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
  },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  rowSub: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, color: colors.textMuted, marginTop: 2 },
  tag: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  tagText: { fontFamily: fonts.bold, fontSize: 11.5 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  listRule: { borderBottomWidth: 1, borderBottomColor: colors.line },
});
