import { FontAwesome, Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authApi } from '@/features/auth/api/authApi';
import { useSession } from '@/features/auth/session/SessionProvider';
import { colors, fonts, radius } from '@/shared/theme/tokens';

/**
 * MOCK of Android's own Google account picker. The real one comes from
 * Google Sign-In once the backend can verify Google ID tokens; Akayza
 * gets name, email and photo, never the password.
 */
const accounts = [
  { name: 'Nomsa Dlamini', email: 'nomsa.spaza@gmail.com', tint: colors.ink },
  { name: 'Nomsa D', email: 'ndlamini.work@gmail.com', tint: '#6B6456' },
];

export default function GooglePicker() {
  const { startGoogleSignUp } = useSession();
  // Set when coming from Create account, where the box was ticked.
  const { consent } = useLocalSearchParams<{ consent?: string }>();
  const [picked, setPicked] = useState<string | null>(null);

  async function pick(name: string, email: string) {
    setPicked(email);
    const result = await authApi.continueWithGoogle(email);
    if (result === 'link') {
      router.replace({ pathname: '/link-google', params: { email } });
    } else {
      startGoogleSignUp(email, name, consent === '1'); // onboarding opens on its own
    }
  }

  return (
    <View style={styles.backdrop}>
      <Pressable style={{ flex: 1 }} onPress={() => router.back()} accessibilityLabel="Close" />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <FontAwesome name="google" size={18} color="#4285F4" />
          <View>
            <Text style={styles.title}>Choose an account</Text>
            <Text style={styles.sub}>to continue to Akayza</Text>
          </View>
        </View>
        {accounts.map((a) => (
          <Pressable
            key={a.email}
            onPress={() => pick(a.name, a.email)}
            disabled={!!picked}
            style={[styles.account, picked === a.email && styles.accountPicked]}>
            <View style={[styles.avatar, { backgroundColor: a.tint }]}>
              <Text style={styles.avatarText}>{a.name[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{a.name}</Text>
              <Text style={styles.sub}>{a.email}</Text>
            </View>
            {picked === a.email ? <ActivityIndicator color={colors.ink} /> : null}
          </Pressable>
        ))}
        <Pressable style={styles.account} disabled>
          <View style={[styles.avatar, { backgroundColor: colors.iconTile }]}>
            <Feather name="plus" size={16} color={colors.textMuted} />
          </View>
          <Text style={styles.name}>Use another account</Text>
        </Pressable>
        <Text style={styles.foot}>
          Google shares your name, email and profile photo with Akayza. Never your password.
        </Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.porcelain,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingBottom: 12,
    gap: 10,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 6 },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  accountPicked: { borderColor: colors.ink, borderWidth: 1.5 },
  avatar: { width: 38, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.display, fontSize: 16, color: colors.white },
  name: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  foot: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textMuted, marginTop: 4 },
});
