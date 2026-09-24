import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SLOGAN } from '@/constants/config';
import { useSession } from '@/features/auth/session/SessionProvider';
import { BrandMark, Wordmark } from '@/shared/components/Brand';
import { Button } from '@/shared/components/Button';
import { brand, fonts } from '@/shared/theme/tokens';

/** Landing: the logo, the slogan, two ways in, and the legal links. Nothing else. */
export default function WelcomeScreen() {
  const { status } = useSession();
  // Closed the app before typing the email code: carry on from there.
  if (status === 'unverified') return <Redirect href="/verify-email" />;

  return (
    <LinearGradient colors={[brand.slate, brand.navy, '#0B1120']} locations={[0, 0.55, 1]} style={styles.fill}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <BrandMark size={112} />
          <Wordmark size={38} onDark />
          <Text style={styles.slogan}>{SLOGAN}</Text>
        </View>

        <View style={styles.actions}>
          <Button title="Get started" variant="accent" onPress={() => router.push('/create-account')} />
          <Pressable accessibilityRole="button" onPress={() => router.push('/sign-in')} style={styles.link}>
            <Text style={styles.linkText}>I already have an account</Text>
          </Pressable>
        </View>

        <View style={styles.legal}>
          <Pressable accessibilityRole="link" onPress={() => router.push('/privacy-policy')} hitSlop={8}>
            <Text style={styles.legalText}>Privacy Policy</Text>
          </Pressable>
          <Text style={styles.legalDot}>·</Text>
          <Pressable accessibilityRole="link" onPress={() => router.push('/terms-of-use')} hitSlop={8}>
            <Text style={styles.legalText}>Terms of Use</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 22 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  slogan: { fontFamily: fonts.medium, fontSize: 16, color: 'rgba(248,250,252,0.78)', textAlign: 'center' },
  actions: { gap: 4 },
  link: { alignItems: 'center', paddingVertical: 16 },
  linkText: { fontFamily: fonts.bold, fontSize: 14.5, color: brand.emeraldLight },
  legal: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, paddingBottom: 14 },
  legalText: { fontFamily: fonts.medium, fontSize: 12.5, color: 'rgba(248,250,252,0.6)', textDecorationLine: 'underline' },
  legalDot: { color: 'rgba(248,250,252,0.4)' },
});
