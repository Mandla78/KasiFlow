import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSession } from '@/features/auth/session/SessionProvider';
import { Card, ListRow } from '@/shared/components/Parts';
import { Overline } from '@/shared/components/Text';
import { colors } from '@/shared/theme/tokens';

import type { Job } from '../../types';
import { networkApi } from '../api/networkApi';
import type { JobPartner } from '../types';
import { PartnerOnJob } from './PartnerOnJob';

/**
 * On a job: the partners you brought in (with their pay and payments), and
 * "Bring in a partner" while the job still has stages to do.
 */
export function JobPartners({ job }: { job: Job }) {
  const { profile } = useSession();
  const [partners, setPartners] = useState<JobPartner[]>([]);
  const at = profile.location ?? undefined;
  const me = profile.ownerName || profile.businessName;
  const suburb = job.place.split(',')[0]?.trim() ?? '';

  const load = useCallback(() => {
    let live = true;
    networkApi
      .partnersOnJob(job.id, at)
      .then((rows) => live && setPartners(rows))
      .catch(() => undefined); // the job itself still shows; partners come back on the next visit
    return () => {
      live = false;
    };
  }, [job.id, at]);
  useFocusEffect(load);

  const canAdd = job.status === 'active' && job.stages.some((s) => s.status !== 'confirmed');
  if (!partners.length && !canAdd) return null;

  return (
    <View style={styles.section}>
      <Overline>Partners on this job</Overline>
      <Card style={{ paddingTop: 0, paddingBottom: 4 }}>
        {partners.map((p) => (
          <View key={p.id} style={styles.rule}>
            <PartnerOnJob partner={p} jobTitle={job.title} suburb={suburb} me={me} onChanged={load} />
          </View>
        ))}
        {canAdd ? (
          <ListRow
            icon="user-plus"
            title="Bring in a partner"
            subtitle={partners.length ? 'Someone else for another stage or trade' : 'A plumber, electrician, another pair of hands... You state their pay first.'}
            onPress={() => router.push({ pathname: '/informal-business/jobs/[id]/partner', params: { id: job.id } })}
            last
          />
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  rule: { borderBottomWidth: 1, borderBottomColor: colors.line },
});
