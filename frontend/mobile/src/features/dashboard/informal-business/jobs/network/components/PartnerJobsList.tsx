import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useSession } from '@/features/auth/session/SessionProvider';
import { Card, Tag } from '@/shared/components/Parts';
import { Overline } from '@/shared/components/Text';
import { colors, fonts } from '@/shared/theme/tokens';

import { networkApi } from '../api/networkApi';
import { listText, payShort } from '../lib/pay';
import { shortDay } from '../lib/postText';
import type { Invite } from '../types';

/**
 * On My jobs: other builders' jobs you're invited to (answer first) or
 * working on as a partner. Tap one for the offer, contact and payments.
 */
export function PartnerJobsList() {
  const { profile } = useSession();
  const [invites, setInvites] = useState<Invite[]>([]);
  const at = profile.location ?? undefined;

  useFocusEffect(
    useCallback(() => {
      let live = true;
      networkApi
        .invites(at)
        .then((rows) => live && setInvites(rows))
        .catch(() => undefined); // your own jobs still show; this list comes back on the next visit
      return () => {
        live = false;
      };
    }, [at]),
  );

  const open = (i: Invite) => router.push({ pathname: '/informal-business/jobs/invites/[inviteId]', params: { inviteId: i.id } });
  const fresh = invites.filter((i) => i.status === 'invited');
  const working = invites.filter((i) => i.status === 'accepted');
  if (!invites.length) return null;

  return (
    <>
      {fresh.length ? (
        <View style={styles.section}>
          <Overline>Invites for you</Overline>
          {fresh.map((i) => (
            <Card key={i.id} onPress={() => open(i)} style={{ gap: 6 }}>
              <View style={styles.head}>
                <Text style={styles.title} numberOfLines={1}>
                  {i.owner.name.split(' ')[0]} invites you
                </Text>
                <Tag label="New" tone="marigold" />
              </View>
              <Text style={styles.detail}>
                {i.jobTitle} · {i.suburb} · {listText(i.stageNames)}
              </Text>
              <Text style={styles.pay}>
                {payShort(i.offer)} · from {shortDay(i.startsOn)}
              </Text>
            </Card>
          ))}
        </View>
      ) : null}
      {working.length ? (
        <View style={styles.section}>
          <Overline>Jobs with partners</Overline>
          {working.map((i) => (
            <Card key={i.id} onPress={() => open(i)} style={{ gap: 6 }}>
              <View style={styles.head}>
                <Text style={styles.title} numberOfLines={1}>
                  {i.jobTitle}
                </Text>
                <Tag label="Partner" tone="info" />
              </View>
              <Text style={styles.detail}>
                With {i.owner.name.split(' ')[0]} · {i.suburb} · {listText(i.stageNames)}
              </Text>
              <Text style={styles.pay}>{payShort(i.offer)}</Text>
            </Card>
          ))}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  detail: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  pay: { fontFamily: fonts.bold, fontSize: 14, color: colors.jade },
});
