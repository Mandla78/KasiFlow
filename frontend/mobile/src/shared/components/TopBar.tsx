import { Feather } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, sizes } from '@/shared/theme/tokens';

type Props = {
  initial: string;
  title: string;
  subtitle?: string;
  action?: { icon: ComponentProps<typeof Feather>['name']; label: string; onPress: () => void; dot?: boolean };
  /** A small green tick on the avatar (CIPC-verified business). */
  verified?: boolean;
  /** Tapping the avatar opens the business profile. */
  onAvatarPress?: () => void;
  /** The business's profile photo, shown instead of the initial. */
  imageUrl?: string | null;
};

/** Tab screens' top bar: the business and one action (usually the bell). */
export function TopBar({ initial, title, subtitle, action, verified, onAvatarPress, imageUrl }: Props) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onAvatarPress}
        disabled={!onAvatarPress}
        accessibilityRole={onAvatarPress ? 'button' : undefined}
        accessibilityLabel={verified ? 'Business profile, verified' : 'Business profile'}
        style={styles.avatar}>
        {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.photo} /> : <Text style={styles.initial}>{initial.toUpperCase()}</Text>}
        {verified ? (
          <View style={styles.tick}>
            <Feather name="check" size={9} color={colors.white} />
          </View>
        ) : null}
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action ? (
        <Pressable accessibilityRole="button" accessibilityLabel={action.label} onPress={action.onPress} style={styles.action}>
          <Feather name={action.icon} size={17} color={colors.ink} />
          {action.dot ? <View style={styles.dot} /> : null}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 38, height: 38, borderRadius: radius.sm, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: fonts.display, fontSize: 16, color: colors.white },
  photo: { width: 38, height: 38, borderRadius: radius.sm },
  tick: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.jade,
    borderWidth: 2,
    borderColor: colors.porcelain,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fonts.display, fontSize: 19, color: colors.ink },
  subtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  action: {
    width: sizes.iconButton,
    height: sizes.iconButton,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { position: 'absolute', top: 7, right: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: colors.marigold },
});
