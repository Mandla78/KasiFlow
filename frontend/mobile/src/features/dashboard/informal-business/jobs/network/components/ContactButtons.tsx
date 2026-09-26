import { Feather, FontAwesome } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '@/shared/theme/tokens';

import { call, openWhatsApp } from '../lib/contact';

const WHATSAPP_GREEN = '#128C4B';

/**
 * WhatsApp and Call, from the builder's own phone. `compact` is the round
 * icon pair for list rows; otherwise two big buttons side by side.
 */
export function ContactButtons({ name, phone, message, compact }: { name: string; phone: string; message: string; compact?: boolean }) {
  if (compact) {
    return (
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel={`WhatsApp ${name}`} hitSlop={4} onPress={() => openWhatsApp(phone, message)} style={[styles.round, styles.wa]}>
          <FontAwesome name="whatsapp" size={20} color={colors.white} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Call ${name}`} hitSlop={4} onPress={() => call(phone)} style={[styles.round, styles.call]}>
          <Feather name="phone" size={17} color={colors.ink} />
        </Pressable>
      </View>
    );
  }
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={`WhatsApp ${name}`} onPress={() => openWhatsApp(phone, message)} style={[styles.big, styles.wa]}>
        <FontAwesome name="whatsapp" size={20} color={colors.white} />
        <Text style={[styles.label, { color: colors.white }]}>WhatsApp</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Call ${name}`} onPress={() => call(phone)} style={[styles.big, styles.call]}>
        <Feather name="phone" size={17} color={colors.ink} />
        <Text style={styles.label}>Call</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  round: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  big: { flex: 1, height: 52, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  wa: { backgroundColor: WHATSAPP_GREEN },
  call: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  label: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.ink },
});
