import { Feather } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { Screen } from '@/shared/components/Screen';
import { Body, Title } from '@/shared/components/Text';
import { colors } from '@/shared/theme/tokens';

export default function ResetSent() {
  const { email = '' } = useLocalSearchParams<{ email: string }>();
  return (
    <Screen
      footer={
        <>
          <Button title="Open email app" onPress={() => Linking.openURL('mailto:')} />
          <Button title="Back to sign in" variant="secondary" onPress={() => router.replace('/sign-in')} />
        </>
      }>
      <View style={styles.center}>
        <View style={styles.circle}>
          <Feather name="mail" size={30} color={colors.white} />
        </View>
        <Title style={{ textAlign: 'center' }}>Check your email</Title>
        <Body style={{ textAlign: 'center' }}>
          If there&apos;s an account for {email}, a reset link is on its way. It works once and expires in 30 minutes.
        </Body>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: 14, paddingTop: 90, paddingHorizontal: 8 },
  circle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
});
