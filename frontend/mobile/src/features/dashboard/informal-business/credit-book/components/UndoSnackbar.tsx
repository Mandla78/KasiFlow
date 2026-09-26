/**
 * "Moved to the bin. Undo" -- a bar at the bottom for 5 seconds after a
 * delete. Undo restores the item; otherwise it quietly goes. Used by the
 * credit book and jobs.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '@/shared/theme/tokens';

export const UNDO_MS = 5000;

type Props = { message: string; onUndo: () => Promise<void>; onDone: () => void };

export function UndoSnackbar({ message, onUndo, onDone }: Props) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (busy) return;
    const timer = setTimeout(onDone, UNDO_MS);
    return () => clearTimeout(timer);
  }, [busy, onDone]);

  async function undo() {
    setBusy(true);
    try {
      await onUndo();
    } finally {
      onDone();
    }
  }

  return (
    <View style={styles.bar} accessibilityLiveRegion="polite">
      <Text style={styles.text}>{message}</Text>
      <Pressable accessibilityRole="button" onPress={undo} disabled={busy} hitSlop={8} style={styles.action}>
        {busy ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.undo}>Undo</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  text: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.white },
  action: { minWidth: 56, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  undo: { fontFamily: fonts.bold, fontSize: 14.5, color: '#93C5FD' },
});
