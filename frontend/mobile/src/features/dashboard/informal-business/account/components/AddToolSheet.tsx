import { StyleSheet, Text } from 'react-native';

import { Sheet } from '@/features/dashboard/informal-business/credit-book/components/Sheet';
import { Button } from '@/shared/components/Button';
import { colors, fonts } from '@/shared/theme/tokens';

import { ToolSwitches } from './ToolSwitches';

/**
 * "Add a tool" from Account: the same switches as More -> Tools, each
 * saved to the server as it's flipped. Mount it only while open.
 */
export function AddToolSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet visible onClose={onClose} title="Your tools">
      <Text style={styles.intro}>Switch on what your business needs. You can change this any time.</Text>
      <ToolSwitches />
      <Button title="Done" onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  intro: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted },
});
