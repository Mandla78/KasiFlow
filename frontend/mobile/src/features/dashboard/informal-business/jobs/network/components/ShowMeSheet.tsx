import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { Button } from '@/shared/components/Button';
import { Sheet } from '@/shared/components/Sheet';
import { colors, fonts } from '@/shared/theme/tokens';

/**
 * Inviting someone, posting or answering a post shows you to other builders, so
 * it needs your yes first ("Show me to other builders"). Mount while open.
 */
export function ShowMeSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet visible onClose={onClose}>
      <Text style={styles.title}>Show yourself to other builders first</Text>
      <Text style={styles.body}>
        Other builders see your name, trades, suburb and the builds you choose. Never your clients, and your number only once you work a job together. You can hide it again any time.
      </Text>
      <Button
        title="Set up my builder profile"
        icon="user"
        onPress={() => {
          onClose();
          router.push('/informal-business/jobs/my-profile');
        }}
      />
      <Button title="Not now" variant="secondary" onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 19, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.text },
});
