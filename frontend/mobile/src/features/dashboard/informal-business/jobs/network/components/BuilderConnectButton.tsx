import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, fonts, radius } from '@/shared/theme/tokens';

import type { ConnectionState } from '../types';

const LABEL: Record<ConnectionState, string> = { none: 'Connect', requested: 'Requested', incoming: 'Accept', connected: 'Connected' };

/** Connect -> Requested (waiting for them). "Accept" when they asked you first. */
export function BuilderConnectButton({ name, state, busy, onPress }: { name: string; state: ConnectionState; busy?: boolean; onPress: () => void }) {
  const waiting = state === 'requested' || state === 'connected';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={state === 'none' ? `Connect with ${name}` : state === 'incoming' ? `Accept ${name}` : `${LABEL[state]}: ${name}`}
      accessibilityState={{ disabled: waiting, busy: !!busy }}
      disabled={waiting || busy}
      onPress={onPress}
      hitSlop={6}
      style={[styles.button, waiting && styles.waiting]}>
      {busy ? (
        <ActivityIndicator size="small" color={colors.white} />
      ) : (
        <>
          {waiting ? <Feather name={state === 'connected' ? 'check' : 'clock'} size={14} color={colors.accentDeep} /> : null}
          <Text style={[styles.text, waiting && styles.textWaiting]}>{LABEL[state]}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minWidth: 104,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
  },
  waiting: { backgroundColor: colors.accentTint },
  text: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.white },
  textWaiting: { color: colors.accentDeep },
});
