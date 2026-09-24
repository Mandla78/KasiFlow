import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useSession } from '@/features/auth/session/SessionProvider';
import { Button } from '@/shared/components/Button';
import { ConsentCheckbox } from '@/shared/components/ConsentCheckbox';
import { Tag } from '@/shared/components/Parts';
import { BackButton, Screen } from '@/shared/components/Screen';
import { Body, Title } from '@/shared/components/Text';
import { TextField } from '@/shared/components/TextField';
import { colors, fonts, radius } from '@/shared/theme/tokens';

/** Google path: no code and no password, just the business name (and consent if not given yet). */
export default function NameBusinessScreen() {
  const { profile, updateProfile, acceptConsent, signOut } = useSession();
  const [businessName, setBusinessName] = useState(profile.businessName);
  const [ownerName, setOwnerName] = useState(profile.ownerName);
  const [agreed, setAgreed] = useState(!!profile.consent);
  const [touched, setTouched] = useState(false);
  const nameError = businessName.trim().length < 2 ? 'Give your business a name' : '';
  const needsConsent = !profile.consent;

  function next() {
    setTouched(true);
    if (nameError || !agreed) return;
    if (needsConsent) acceptConsent();
    updateProfile({ businessName: businessName.trim(), ownerName: ownerName.trim() });
    router.push('/your-business');
  }

  return (
    <Screen
      footer={
        <>
          {needsConsent ? <ConsentCheckbox checked={agreed} onChange={setAgreed} error={touched} /> : null}
          <Button title="Continue" onPress={next} disabled={!agreed} />
        </>
      }>
      {/* Back out of Google sign-up entirely: returns to the landing screen. */}
      <BackButton onPress={signOut} />
      <View style={styles.pill}>
        <FontAwesome name="google" size={14} color="#4285F4" />
        <Text style={styles.pillText} numberOfLines={1}>
          {profile.email}
        </Text>
        <Tag label="Verified by Google" tone="jade" />
      </View>
      <View style={{ gap: 8 }}>
        <Title>Name your business</Title>
        <Body>Google already confirmed your email, so there&apos;s no code and no password to remember.</Body>
      </View>
      <TextField
        label="Business (trading) name"
        placeholder="e.g. Nomsa's Spaza"
        value={businessName}
        onChangeText={setBusinessName}
        autoCapitalize="words"
        error={touched ? nameError : ''}
      />
      <TextField
        label="Your name"
        value={ownerName}
        onChangeText={setOwnerName}
        autoCapitalize="words"
        hint="From your Google account. You can change it."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 6,
  },
  pillText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.text },
});
