import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, fonts, radius } from '@/shared/theme/tokens';

/** Connect / Connected. Both ask first (see useConnect). */
export function ConnectButton({ name, connected, onPress }: { name: string; connected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={connected ? `Connected to ${name}. Tap to disconnect` : `Connect with ${name}`}
      onPress={onPress}
      hitSlop={6}
      style={[styles.button, connected && styles.on]}>
      {connected ? <Feather name="check" size={15} color={colors.accentDeep} /> : null}
      <Text style={[styles.text, connected && styles.textOn]}>{connected ? 'Connected' : 'Connect'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  on: { backgroundColor: colors.accentTint, borderColor: colors.accentTint },
  text: { fontFamily: fonts.bold, fontSize: 13, color: colors.white },
  textOn: { color: colors.accentDeep },
});
