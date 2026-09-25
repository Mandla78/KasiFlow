import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useSession } from '@/features/auth/session/SessionProvider';
import { ApiError } from '@/shared/api/client';
import { Button } from '@/shared/components/Button';
import { Card, IconTile, InfoNote } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { ConfirmSheet } from '@/shared/components/Sheet';
import { Overline } from '@/shared/components/Text';
import { formatRand } from '@/shared/lib/money';
import { colors, fonts } from '@/shared/theme/tokens';

import { networkApi, practiceApi } from '../api/networkApi';
import { ContactButtons } from '../components/ContactButtons';
import { OfferCard } from '../components/OfferCard';
import { PaySheet } from '../components/PaySheet';
import { PersonRow } from '../components/PersonRow';
import { helloText } from '../lib/contact';
import { paymentText, stillOwed } from '../lib/pay';
import type { Invite, PartnerPayment } from '../types';

/**
 * An invite onto another builder's job, from the partner's side: the offer
 * with the pay, before saying yes (like a driver sees the fare). Once you
 * accept: WhatsApp/Call the owner, and confirm each cash payment you get.
 */
export default function InviteScreen() {
  const { inviteId } = useLocalSearchParams<{ inviteId: string }>();
  const { profile } = useSession();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [confirming, setConfirming] = useState<PartnerPayment | null>(null);
  const [error, setError] = useState('');
  const at = profile.location ?? undefined;
  const me = profile.ownerName || profile.businessName;

  const load = useCallback(() => {
    let live = true;
    networkApi
      .getInvite(inviteId ?? '', at)
      .then((i) => live && setInvite(i))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [inviteId, at]);
  useFocusEffect(load);

  async function answer(accept: boolean) {
    if (busy || !invite) return;
    setBusy(true);
    setError('');
    try {
      setInvite(await networkApi.answerInvite(invite.id, accept));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send your answer. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!invite) {
    return (
      <Screen back>
        {failed ? (
          <Card style={styles.center}>
            <IconTile name="search" size={44} />
            <Text style={styles.muted}>We couldn&apos;t open this invite.</Text>
          </Card>
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}
      </Screen>
    );
  }

  const owner = invite.owner;
  const name = owner.name.split(' ')[0] ?? owner.name;
  const owed = stillOwed(invite.offer, invite.payments);
  const waiting = invite.payments.some((p) => p.status === 'waiting');

  return (
    <Screen
      back
      footer={
        invite.status === 'invited' ? (
          <>
            <Button title="Accept" icon="check" loading={busy} onPress={() => answer(true)} />
            <Button title="Decline" variant="secondary" onPress={() => setDeclining(true)} />
          </>
        ) : undefined
      }>
      <OfferCard
        heading={invite.status === 'accepted' ? `You're on ${name}'s job` : `${name} invites you`}
        jobTitle={invite.jobTitle}
        suburb={invite.suburb}
        trade={invite.trade}
        stageNames={invite.stageNames}
        startsOn={invite.startsOn}
        offer={invite.offer}
      />

      {error ? <InfoNote icon="alert-circle">{error}</InfoNote> : null}

      <View style={styles.section}>
        <Overline>The builder</Overline>
        <Card style={{ paddingVertical: 0 }}>
          <PersonRow
            builder={owner}
            line={`${owner.buildsConfirmed} builds confirmed by clients`}
            onOpen={() => router.push({ pathname: '/informal-business/jobs/builders/[builderId]', params: { builderId: owner.id } })}
            last
            right={<Feather name="chevron-right" size={18} color={colors.textFaint} />}
          />
        </Card>
      </View>

      {invite.status === 'invited' ? (
        <InfoNote icon="shield">If you accept, you and {name} get each other&apos;s number. The pay above is what you agree to; {name} pays you in cash and you both confirm it here.</InfoNote>
      ) : null}
      {invite.status === 'declined' ? <InfoNote icon="x-circle">You said no to this one.</InfoNote> : null}

      {invite.status === 'accepted' ? (
        <>
          {owner.phone ? <ContactButtons name={owner.name} phone={owner.phone} message={helloText(owner.name, me)} /> : null}

          <View style={styles.section}>
            <Overline>Your pay</Overline>
            <Card style={{ gap: 10 }}>
              {invite.payments.length ? (
                invite.payments.map((p) => (
                  <View key={p.id} style={{ gap: 8 }}>
                    <View style={styles.payment}>
                      <Feather
                        name={p.status === 'confirmed' ? 'check-circle' : p.status === 'waiting' ? 'clock' : 'alert-circle'}
                        size={15}
                        color={p.status === 'confirmed' ? colors.jade : p.status === 'waiting' ? colors.marigoldDeep : colors.garnet}
                      />
                      <Text style={styles.paymentText}>{paymentText(p, 'partner', name)}</Text>
                    </View>
                    {p.status === 'waiting' ? <Button title="Confirm what I got" variant="secondary" onPress={() => setConfirming(p)} /> : null}
                  </View>
                ))
              ) : (
                <Text style={styles.muted}>No payments yet. When {name} pays you, confirm it here.</Text>
              )}
              <Text style={styles.small}>{owed > 0 ? `Still to come: ${formatRand(owed)}` : 'Paid in full.'}</Text>
            </Card>
          </View>

          {practiceApi && owed > 0 && !waiting ? (
            <Pressable
              accessibilityRole="button"
              onPress={async () => {
                await practiceApi?.ownerPays(invite.id);
                load();
              }}
              style={styles.test}>
              <Feather name="smartphone" size={14} color={colors.accentDeep} />
              <Text style={styles.testText}>
                Test: {name} pays you {formatRand(owed)}
              </Text>
            </Pressable>
          ) : null}
        </>
      ) : null}

      {declining ? (
        <ConfirmSheet
          visible
          title="Say no to this job?"
          message={`${name} is told you can't take it. No reason needed.`}
          confirmLabel="Decline"
          onCancel={() => setDeclining(false)}
          onConfirm={() => {
            setDeclining(false);
            answer(false);
          }}
        />
      ) : null}

      {confirming ? (
        <PaySheet
          title="What did you get?"
          intro={`${name} says they paid you ${formatRand(confirming.ownerAmountCents)}. Type the cash you actually got; if it's different, both amounts are kept.`}
          label="Cash you got"
          startCents={confirming.ownerAmountCents}
          confirmLabel="Confirm"
          onClose={() => setConfirming(null)}
          onSave={async (cents) => {
            setInvite(await networkApi.confirmPayment(invite.id, confirming.id, cents));
            setConfirming(null);
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: 40, alignItems: 'center' },
  center: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  muted: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted },
  small: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textMuted },
  section: { gap: 8 },
  payment: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  paymentText: { flex: 1, fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, color: colors.text },
  test: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 40 },
  testText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.accentDeep },
});
