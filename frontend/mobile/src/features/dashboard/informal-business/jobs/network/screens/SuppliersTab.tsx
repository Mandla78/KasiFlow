import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { Button } from '@/shared/components/Button';
import { Card, IconTile } from '@/shared/components/Parts';
import { colors, fonts } from '@/shared/theme/tokens';

/**
 * Suppliers for a builder's jobs: materials per stage, from suppliers that
 * deliver to the site. Mandla wires it after the supplier work; until then
 * it says what's coming, with no made-up suppliers.
 */
export function SuppliersTab() {
  return (
    <Card style={styles.center}>
      <IconTile name="truck" size={56} />
      <Text style={styles.title}>Suppliers for your jobs</Text>
      <Text style={styles.body}>
        Soon: the materials each stage needs, from suppliers that deliver to your site. For now, find suppliers in the Suppliers tab below.
      </Text>
      <Button title="Open Suppliers" variant="secondary" icon="shopping-bag" onPress={() => router.push('/informal-business/suppliers')} />
    </Card>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted, textAlign: 'center' },
});
