import { StyleSheet, Text } from 'react-native';

import type { ToolKey } from '@/constants/businessTypes';
import { useSession } from '@/features/auth/session/SessionProvider';
import { Sheet } from '@/features/dashboard/informal-business/credit-book/components/Sheet';
import { Button } from '@/shared/components/Button';
import { ToggleRow } from '@/shared/components/Parts';
import { colors, fonts } from '@/shared/theme/tokens';

const TOOLS: { key: ToolKey; icon: 'book' | 'package' | 'tool' | 'shield'; title: string; subtitle: string }[] = [
  { key: 'creditBook', icon: 'book', title: 'Credit book', subtitle: 'Who owes you, and when they pay' },
  { key: 'orderStock', icon: 'package', title: 'Order stock', subtitle: 'Buy from suppliers who deliver to you' },
  { key: 'jobs', icon: 'tool', title: 'Jobs', subtitle: 'Stages, photos and the client’s sign-off' },
  { key: 'myRecord', icon: 'shield', title: 'My record', subtitle: 'Always on: it’s your proof of trading' },
];

/**
 * "Add a tool": a switch per tool, saved to the business profile (the
 * session syncs it). My record can't be switched off; the daily tally is
 * coming. Mount it only while open.
 */
export function AddToolSheet({ onClose }: { onClose: () => void }) {
  const { profile, setTool } = useSession();
  return (
    <Sheet visible onClose={onClose} title="Your tools">
      <Text style={styles.intro}>Switch on what your business needs. You can change this any time.</Text>
      {TOOLS.map((t) => (
        <ToggleRow
          key={t.key}
          icon={t.icon}
          title={t.title}
          subtitle={t.subtitle}
          value={t.key === 'myRecord' ? true : profile.tools[t.key]}
          locked={t.key === 'myRecord'}
          onChange={(on) => setTool(t.key, on)}
        />
      ))}
      <ToggleRow icon="bar-chart-2" title="Daily tally" subtitle="Cash in and out, day by day" soon />
      <Button title="Done" onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  intro: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted },
});
