import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Card, ListRow } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Overline } from '@/shared/components/Text';
import { TopBar } from '@/shared/components/TopBar';
import { areaOf, isVerified } from '@/features/auth/profile';
import { BUSINESS_TYPES } from '@/constants/businessTypes';
import { useSession } from '@/features/auth/session/SessionProvider';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { CipcStatusCard } from '../components/CipcStatusCard';

/** Everything that isn't daily work: profile, business, app settings, support, sign out. */
export default function More() {
  const { profile, signOut } = useSession();
  const toolsOn = Object.values(profile.tools).filter(Boolean).length;

  return (
    <Screen tab>
      <TopBar
        verified={isVerified(profile)}
        onAvatarPress={() => router.push('/informal-business/business')} initial={profile.businessName[0] ?? 'K'} title="More" subtitle={profile.businessName} />

      <Card onPress={() => router.push('/informal-business/business')}>
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(profile.ownerName[0] ?? 'K').toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{profile.ownerName}</Text>
              {isVerified(profile) ? (
                <View style={styles.verified}>
                  <Feather name="check-circle" size={12} color={colors.accentDeep} />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.sub}>
              {profile.businessName} · {areaOf(profile)}
            </Text>
            <Text style={styles.sub}>{profile.email}</Text>
          </View>
          <Feather name="chevron-right" size={17} color={colors.textFaint} />
        </View>
      </Card>

      <Overline>Business</Overline>
      {profile.registration.cipc ? <CipcStatusCard cipc={profile.registration.cipc} businessName={profile.businessName} /> : null}
      <Card style={styles.group}>
        <ListRow
          icon="shopping-bag"
          title="Business profile"
          subtitle={profile.businessType ? `${BUSINESS_TYPES[profile.businessType].label} · edit your sign-up answers` : 'Not set'}
          onPress={() => router.push('/informal-business/business')}
        />
        <ListRow icon="map-pin" title="Delivery addresses" subtitle="Shop · Home" />
        <ListRow icon="grid" title="Tools" subtitle={`${toolsOn} on`} last />
      </Card>

      <Overline>App</Overline>
      <Card style={styles.group}>
        <ListRow icon="bell" title="Notifications" />
        <ListRow icon="lock" title="Security" subtitle="Phones, password, your data" onPress={() => router.push('/informal-business/security')} />
        <ListRow icon="credit-card" title="Payment cards" subtitle="Test mode" onPress={() => router.push('/informal-business/payment-cards')} />
        <ListRow icon="globe" title="Language" subtitle="English" />
        <ListRow icon="refresh-cw" title="Data saver" subtitle="On" last />
      </Card>

      <Overline>Support</Overline>
      <Card style={styles.group}>
        <ListRow icon="help-circle" title="Help and WhatsApp support" />
        <ListRow icon="log-out" title="Sign out" danger onPress={signOut} last />
      </Card>
      <Text style={styles.version}>Akayza 0.1.0 · preview build</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 50, height: 50, borderRadius: radius.md, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.display, fontSize: 20, color: colors.white },
  name: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.accentTint, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 },
  verifiedText: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.accentDeep },
  sub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, marginTop: 1 },
  group: { paddingVertical: 4 },
  version: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textFaint, textAlign: 'center' },
});
