import { Feather } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '@/shared/theme/tokens';

type IconName = ComponentProps<typeof Feather>['name'];

/** A selectable choice with an icon, a title and a line under it. */
export function OptionCard({
  icon,
  title,
  line,
  selected,
  disabled,
  onPress,
}: {
  icon: IconName;
  title: string;
  line: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      style={[styles.card, selected && styles.on, disabled && { opacity: 0.45 }]}>
      <Feather name={icon} size={20} color={selected ? colors.accentDeep : colors.ink} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.line}>{line}</Text>
      </View>
      <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <View style={styles.dot} /> : null}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  on: { borderColor: colors.accent, backgroundColor: colors.accentTint },
  title: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  line: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, color: colors.textMuted, marginTop: 2 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.accent },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
});
