import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/shared/api/client';
import { Button } from '@/shared/components/Button';
import { Sheet } from '@/shared/components/Sheet';
import { TextField } from '@/shared/components/TextField';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import type { ReportReason } from '../types';

const REASONS: { key: ReportReason; label: string }[] = [
  { key: 'fake', label: 'Not a real builder' },
  { key: 'not_their_work', label: "The photos aren't their work" },
  { key: 'scam', label: 'Asked for money or a scam' },
  { key: 'rude', label: 'Rude or threatening' },
  { key: 'other', label: 'Something else' },
];

type Step = 'menu' | 'report' | 'block';

/**
 * The "..." on a builder: report (with a reason; we review every report)
 * or block (they disappear for you and can't find you). Mount while open.
 */
export function ReportBlockSheet({
  name,
  onClose,
  onReport,
  onBlock,
}: {
  name: string;
  onClose: () => void;
  onReport: (reason: ReportReason, note: string) => Promise<void>;
  onBlock: () => Promise<void>;
}) {
  const [step, setStep] = useState<Step>('menu');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const first = name.split(' ')[0];

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send it. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <Sheet visible onClose={onClose}>
      {step === 'menu' ? (
        <>
          <Text style={styles.title}>{name}</Text>
          <Pressable accessibilityRole="button" onPress={() => setStep('report')} style={styles.option}>
            <Feather name="flag" size={18} color={colors.ink} />
            <Text style={styles.optionText}>Report {first}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setStep('block')} style={styles.option}>
            <Feather name="slash" size={18} color={colors.garnet} />
            <Text style={[styles.optionText, { color: colors.garnet }]}>Block {first}</Text>
          </Pressable>
          <Button title="Cancel" variant="secondary" onPress={onClose} />
        </>
      ) : step === 'report' ? (
        <>
          <Text style={styles.title}>Why are you reporting {first}?</Text>
          <View style={{ gap: 8 }}>
            {REASONS.map((r) => (
              <Pressable
                key={r.key}
                accessibilityRole="radio"
                accessibilityState={{ checked: reason === r.key }}
                onPress={() => setReason(r.key)}
                style={[styles.reason, reason === r.key && styles.reasonOn]}>
                <Text style={styles.reasonText}>{r.label}</Text>
                {reason === r.key ? <Feather name="check" size={18} color={colors.accentDeep} /> : null}
              </Pressable>
            ))}
          </View>
          {reason ? <TextField label={reason === 'other' ? 'What happened?' : 'Anything to add?'} optional={reason !== 'other'} value={note} onChangeText={setNote} maxLength={200} /> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.small}>We review every report. {first} isn&apos;t told who reported them.</Text>
          <Button title="Send report" loading={busy} disabled={!reason || (reason === 'other' && !note.trim())} onPress={() => reason && run(() => onReport(reason, note))} />
          <Button title="Back" variant="secondary" onPress={() => setStep('menu')} />
        </>
      ) : (
        <>
          <Text style={styles.title}>Block {first}?</Text>
          <Text style={styles.body}>
            {first} disappears for you, and can&apos;t find you or contact you through Akayza. They aren&apos;t told. You can still report them.
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title={`Block ${first}`} variant="danger" loading={busy} onPress={() => run(onBlock)} />
          <Button title="Back" variant="secondary" onPress={() => setStep('menu')} />
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 19, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.text },
  small: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.textMuted },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.garnet },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, borderBottomWidth: 1, borderBottomColor: colors.line },
  optionText: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.ink },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  reasonOn: { borderColor: colors.accent, backgroundColor: colors.accentTint },
  reasonText: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.text },
});
