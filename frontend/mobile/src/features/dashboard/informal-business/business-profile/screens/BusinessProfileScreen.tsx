import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { BUSINESS_TYPES, TRADES } from '@/constants/businessTypes';
import { CATEGORIES } from '@/constants/categories';
import { isVerified } from '@/features/auth/profile';
import { useSession } from '@/features/auth/session/SessionProvider';
import type { Profile } from '@/features/auth/types';
import { Card, ListRow } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Overline } from '@/shared/components/Text';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { CipcStatusCard } from '../../more/components/CipcStatusCard';

const YEARS = { under_1: 'Less than a year', '1_3': '1 to 3 years', '3_plus': 'More than 3 years' } as const;
const FULFIL = { delivery: 'Delivered', collect: 'I collect', either: 'Delivered or collect' } as const;

function aboutLine(p: Profile): string {
  const type = p.businessType ? BUSINESS_TYPES[p.businessType].label : 'Type not set';
  const trade = p.trade ? TRADES.find((t) => t.key === p.trade)?.label : null;
  return [trade ?? type, p.yearsTrading ? YEARS[p.yearsTrading] : null].filter(Boolean).join(' · ');
}

function placeLine(p: Profile): string {
  const l = p.location;
  if (!l) return 'Not set';
  // A typed "as is" address can repeat the suburb: show each part once.
  return [...new Set([l.building, l.street, l.suburb, l.city].map((x) => x.trim()).filter(Boolean))].join(', ');
}

function buyingLine(p: Profile): string {
  const names = p.categories.map((c) => CATEGORIES.find((x) => x.code === c)?.label).filter(Boolean) as string[];
  const cats = names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ') || 'Nothing chosen';
  return p.buying.fulfilment ? `${cats} · ${FULFIL[p.buying.fulfilment]}` : cats;
}

function registrationLine(p: Profile): string {
  if (p.registration.cipc) return `CIPC ${p.registration.cipc.number}`;
  return p.registration.soleTrader ? 'Sole trader' : 'Not added';
}

/**
 * More -> Business profile: everything asked at sign-up, each answer one
 * tap from its own edit screen (the same screens, in edit mode).
 */
export default function BusinessProfileScreen() {
  const { profile } = useSession();
  const verified = isVerified(profile);
  const cipc = profile.registration.cipc;

  return (
    <Screen back>
      <View style={styles.head}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(profile.businessName[0] ?? 'A').toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.name}>{profile.businessName}</Text>
          <Text style={styles.sub}>{profile.ownerName || profile.email}</Text>
          {verified ? (
            <View style={[styles.badge, styles.badgeOn]}>
              <Feather name="check-circle" size={13} color={colors.accentDeep} />
              <Text style={[styles.badgeText, { color: colors.accentDeep }]}>Verified business</Text>
            </View>
          ) : (
            <View style={styles.badge}>
              <Feather name="shield" size={13} color={colors.textMuted} />
              <Text style={styles.badgeText}>Not verified yet</Text>
            </View>
          )}
        </View>
      </View>

      <Overline>Registration</Overline>
      {cipc ? <CipcStatusCard cipc={cipc} businessName={profile.businessName} /> : null}
      <Card style={styles.group}>
        <ListRow
          icon="award"
          title={cipc ? 'CIPC registration' : 'Get verified'}
          subtitle={cipc ? registrationLine(profile) : 'Registered company? Add your CIPC number for a verified badge'}
          onPress={() => router.push('/informal-business/business/registration')}
          last
        />
      </Card>

      <Overline>Your answers</Overline>
      <Card style={styles.group}>
        <ListRow icon="shopping-bag" title="Your business" subtitle={aboutLine(profile)} onPress={() => router.push('/informal-business/business/your-business')} />
        <ListRow icon="map-pin" title="Where you are" subtitle={placeLine(profile)} onPress={() => router.push('/informal-business/business/where-you-are')} />
        <ListRow icon="package" title="What you buy" subtitle={buyingLine(profile)} onPress={() => router.push('/informal-business/business/what-you-buy')} last />
      </Card>
      <Text style={styles.note}>Changes to what you buy and where you are update your supplier matches.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 60, height: 60, borderRadius: radius.md, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.display, fontSize: 24, color: colors.white },
  name: { fontFamily: fonts.display, fontSize: 21, color: colors.ink },
  sub: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: colors.iconTile, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  badgeOn: { backgroundColor: colors.accentTint },
  badgeText: { fontFamily: fonts.bold, fontSize: 12, color: colors.textMuted },
  group: { paddingVertical: 4 },
  note: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted },
});
