import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from './Button';
import { colors, fonts } from '@/shared/theme/tokens';

/**
 * The ⓘ next to a question. Tapping it explains why we ask. It replaces a
 * grey paragraph under every question: whoever wants to know finds out
 * in one tap, and whoever doesn't never has to read it.
 */
export function InfoHint({ title, body, size = 18 }: { title: string; body: string | string[]; size?: number }) {
  const [open, setOpen] = useState(false);
  const paragraphs = Array.isArray(body) ? body : [body];

  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Why we ask this">
        <Feather name="info" size={size} color={colors.textMuted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => setOpen(false)} accessibilityLabel="Close" />
          <SafeAreaView edges={['bottom']} style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.head}>
              <Feather name="info" size={18} color={colors.accentDeep} />
              <Text style={styles.title}>Why we ask</Text>
            </View>
            <Text style={styles.subject}>{title}</Text>
            {paragraphs.map((p, i) => (
              <Text key={i} style={styles.body}>
                {p}
              </Text>
            ))}
            <Button title="Got it" variant="secondary" onPress={() => setOpen(false)} />
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 12,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginTop: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: fonts.bold, fontSize: 13, letterSpacing: 0.4, color: colors.accentDeep, textTransform: 'uppercase' },
  subject: { fontFamily: fonts.display, fontSize: 19, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.text },
});
