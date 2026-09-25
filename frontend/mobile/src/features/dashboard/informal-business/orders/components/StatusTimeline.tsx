import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/shared/theme/tokens';

import { STEP_LABEL, stepsFor, when } from '../lib/status';
import type { Order } from '../types';

/** The order's steps, done ones ticked with their time. */
export function StatusTimeline({ order }: { order: Order }) {
  const steps = stepsFor(order);
  const doneAt = (s: string) => order.events.find((e) => e.status === s)?.at;
  const stopped = order.status === 'cancelled' || order.status === 'rejected';

  return (
    <View style={{ gap: 0 }}>
      {steps.map((s, i) => {
        const at = doneAt(s);
        const bad = stopped && s === order.status;
        return (
          <View key={s} style={styles.step}>
            <View style={styles.rail}>
              <View style={[styles.dot, at && styles.dotDone, bad && styles.dotBad]}>
                {at ? <Feather name={bad ? 'x' : 'check'} size={12} color={colors.white} /> : null}
              </View>
              {i < steps.length - 1 ? <View style={[styles.line, at && doneAt(steps[i + 1]) ? styles.lineDone : null]} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: 14 }}>
              <Text style={[styles.label, !at && styles.pending]}>{STEP_LABEL[s]}</Text>
              {at ? <Text style={styles.time}>{when(at)}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: 'row', gap: 12 },
  rail: { alignItems: 'center', width: 22 },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  dotBad: { backgroundColor: colors.garnet, borderColor: colors.garnet },
  line: { flex: 1, width: 2, backgroundColor: colors.line, minHeight: 18 },
  lineDone: { backgroundColor: colors.accent },
  label: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  pending: { color: colors.textMuted, fontFamily: fonts.medium },
  time: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted, marginTop: 1 },
});
