import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { parseRand } from '@/features/dashboard/informal-business/credit-book/lib/amounts';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { difference, MAX_STAGES, STAGE_NAME_MAX, stagesTotal } from '../lib/stages';

export type DraftStage = { key: string; name: string; amount: string };

type Props = {
  stages: DraftStage[];
  onChange: (stages: DraftStage[]) => void;
  totalCents: number | null;
  error?: string;
};

/**
 * The job's stages: rename, add, remove, an amount each. The difference
 * from the total shows live, so the builder sees what's left to share out.
 */
export function StageEditor({ stages, onChange, totalCents, error }: Props) {
  const amounts = stages.map((s) => ({ amountCents: parseRand(s.amount) ?? 0 }));
  const diff = totalCents ? difference(totalCents, stagesTotal(amounts)) : null;
  const set = (key: string, patch: Partial<DraftStage>) => onChange(stages.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>Stages</Text>
      {stages.map((s, i) => (
        <View key={s.key} style={styles.row}>
          <Text style={styles.index}>{i + 1}</Text>
          <TextInput
            accessibilityLabel={`Stage ${i + 1} name`}
            value={s.name}
            onChangeText={(name) => set(s.key, { name })}
            placeholder="Stage name"
            placeholderTextColor={colors.textFaint}
            maxLength={STAGE_NAME_MAX}
            style={[styles.input, styles.name]}
          />
          <View style={[styles.input, styles.money]}>
            <Text style={styles.r}>R</Text>
            <TextInput
              accessibilityLabel={`${s.name || `Stage ${i + 1}`} amount in rand`}
              value={s.amount}
              onChangeText={(amount) => set(s.key, { amount: amount.replace(/[^\d.,\s]/g, '') })}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.textFaint}
              maxLength={12}
              style={styles.moneyInput}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${s.name || `stage ${i + 1}`}`}
            disabled={stages.length === 1}
            onPress={() => onChange(stages.filter((x) => x.key !== s.key))}
            hitSlop={6}
            style={[styles.remove, stages.length === 1 && { opacity: 0.3 }]}>
            <Feather name="x" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      ))}
      {stages.length < MAX_STAGES ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => onChange([...stages, { key: `new-${Date.now()}`, name: '', amount: '' }])}
          style={styles.add}>
          <Feather name="plus" size={16} color={colors.ink} />
          <Text style={styles.addText}>Add a stage</Text>
        </Pressable>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : diff ? <Text style={[styles.diff, diff.ok && { color: colors.jade }]}>{diff.text}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  index: { width: 16, fontFamily: fonts.bold, fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  input: { height: 48, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  name: { flex: 1.4, paddingHorizontal: 12, fontFamily: fonts.medium, fontSize: 15, color: colors.text, outlineWidth: 0 },
  money: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 2 },
  r: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  moneyInput: { flex: 1, height: '100%', fontFamily: fonts.bold, fontSize: 15, color: colors.ink, outlineWidth: 0 },
  remove: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center' },
  add: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 4 },
  addText: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  diff: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.marigoldDeep },
  error: { fontFamily: fonts.body, fontSize: 12, color: colors.garnet },
});
