import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { Tag } from '@/shared/components/Parts';
import { Sheet } from '@/shared/components/Sheet';
import { formatRand } from '@/shared/lib/money';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { networkApi, practiceApi } from '../api/networkApi';
import { dealText } from '../lib/contact';
import { listText, offerText, paidWhenText, paymentText, stillOwed } from '../lib/pay';
import { daysText, shortDay } from '../lib/postText';
import { tradeLabel } from '../lib/trades';
import type { JobPartner } from '../types';
import { ContactButtons } from './ContactButtons';
import { PaySheet } from './PaySheet';
import { PersonRow } from './PersonRow';

const STATUS: Record<JobPartner['status'], { label: string; tone: 'marigold' | 'jade' | 'muted' }> = {
  invited: { label: 'Invited', tone: 'marigold' },
  accepted: { label: 'On the job', tone: 'jade' },
  declined: { label: 'Said no', tone: 'muted' },
};

/**
 * A partner on your job: their stages and the pay you agreed, whether
 * they've said yes, WhatsApp/Call once they have, and the cash you've paid
 * them (confirmed by both). On the mock, "Test" plays the partner.
 */
export function PartnerOnJob({ partner, jobTitle, suburb, me, onChanged }: { partner: JobPartner; jobTitle: string; suburb: string; me: string; onChanged: () => void }) {
  const [paying, setPaying] = useState(false);
  const [testAnswer, setTestAnswer] = useState(false);
  const b = partner.builder;
  const name = b.name.split(' ')[0] ?? b.name;
  const owed = stillOwed(partner.offer, partner.payments);
  const waiting = partner.payments.some((p) => p.status === 'waiting');
  const status = STATUS[partner.status];

  return (
    <View style={styles.card}>
      <PersonRow
        builder={b}
        line={`${tradeLabel(partner.trade)}: ${listText(partner.stageNames)}`}
        onOpen={() => router.push({ pathname: '/informal-business/jobs/builders/[builderId]', params: { builderId: b.id } })}
        last
        right={<Tag label={status.label} tone={status.tone} />}
      />
      <Text style={styles.detail}>
        From {shortDay(partner.startsOn)} · {daysText(partner.offer.days)}
      </Text>
      <Text style={styles.pay}>
        Pay {offerText(partner.offer)}, {paidWhenText(partner.offer.paidWhen, partner.stageNames)}
      </Text>

      {partner.payments.map((p) => (
        <View key={p.id} style={styles.payment}>
          <Feather
            name={p.status === 'confirmed' ? 'check-circle' : p.status === 'waiting' ? 'clock' : 'alert-circle'}
            size={15}
            color={p.status === 'confirmed' ? colors.jade : p.status === 'waiting' ? colors.marigoldDeep : colors.garnet}
          />
          <Text style={styles.paymentText}>{paymentText(p, 'owner', name)}</Text>
        </View>
      ))}

      {partner.status === 'invited' ? <Text style={styles.muted}>Waiting for {name} to say yes. Numbers are shared once they do.</Text> : null}
      {partner.status === 'declined' ? <Text style={styles.muted}>{name} said no to this one.</Text> : null}

      {partner.status === 'accepted' && b.phone ? (
        <View style={styles.actions}>
          <ContactButtons compact name={b.name} phone={b.phone} message={dealText(b.name, me, { jobTitle, suburb, stageNames: partner.stageNames, startsOn: partner.startsOn, offer: partner.offer })} />
          {owed > 0 ? (
            <Pressable accessibilityRole="button" onPress={() => setPaying(true)} style={styles.paid}>
              <Feather name="dollar-sign" size={15} color={colors.ink} />
              <Text style={styles.paidText}>I paid {name}</Text>
            </Pressable>
          ) : (
            <Text style={styles.done}>Paid in full</Text>
          )}
        </View>
      ) : null}

      {practiceApi && (partner.status === 'invited' || waiting) ? (
        <Pressable
          accessibilityRole="button"
          onPress={async () => {
            if (partner.status === 'invited') setTestAnswer(true);
            else {
              await practiceApi?.confirmAsPartner(partner.id);
              onChanged();
            }
          }}
          style={styles.test}>
          <Feather name="smartphone" size={14} color={colors.accentDeep} />
          <Text style={styles.testText}>{partner.status === 'invited' ? `Test: answer as ${name}` : `Test: confirm as ${name}`}</Text>
        </Pressable>
      ) : null}

      {paying ? (
        <PaySheet
          title={`What did you pay ${name}?`}
          intro={`Cash you gave ${name} for ${listText(partner.stageNames)}. ${name} confirms it on their side. Still owed: ${formatRand(owed)}.`}
          label="Cash paid"
          startCents={owed}
          confirmLabel="Save payment"
          onClose={() => setPaying(false)}
          onSave={async (cents) => {
            await networkApi.recordPayment(partner.id, cents);
            setPaying(false);
            onChanged();
          }}
        />
      ) : null}

      {testAnswer && practiceApi ? (
        <Sheet visible onClose={() => setTestAnswer(false)}>
          <Text style={styles.sheetTitle}>Test: you are {name}</Text>
          <Text style={styles.sheetBody}>
            {name} sees {jobTitle}, {listText(partner.stageNames)}, and the pay: {offerText(partner.offer)}.
          </Text>
          <Button
            title={`Accept as ${name}`}
            onPress={async () => {
              await practiceApi?.answerAsPartner(partner.id, true);
              setTestAnswer(false);
              onChanged();
            }}
          />
          <Button
            title="Decline"
            variant="secondary"
            onPress={async () => {
              await practiceApi?.answerAsPartner(partner.id, false);
              setTestAnswer(false);
              onChanged();
            }}
          />
        </Sheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 6, paddingBottom: 12 },
  detail: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  pay: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  muted: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  payment: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  paymentText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.text },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 4 },
  paid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 42,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  paidText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  done: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.jade },
  test: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 },
  testText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.accentDeep },
  sheetTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.ink },
  sheetBody: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.text },
});
