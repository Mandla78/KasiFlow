import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '@/shared/theme/tokens';

import { listText, offerText, paidWhenText } from '../lib/pay';
import { daysText, shortDay } from '../lib/postText';
import { tradeLabel } from '../lib/trades';
import type { Offer, Trade } from '../types';

/**
 * The invite exactly as the partner sees it, pay first, before they
 * accept: the job, the stages, when, and what they'll get and when. Also
 * the owner's preview before sending. Never the client or the client's price.
 */
export function OfferCard({
  heading,
  jobTitle,
  suburb,
  trade,
  stageNames,
  startsOn,
  offer,
}: {
  heading: string;
  jobTitle: string;
  suburb: string;
  trade: Trade;
  stageNames: string[];
  startsOn: string;
  offer: Offer;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>{heading}</Text>
      <Text style={styles.job}>
        {jobTitle} · {suburb}
      </Text>
      <Text style={styles.what}>
        {tradeLabel(trade)}: {listText(stageNames)}
      </Text>
      <View style={styles.line}>
        <Feather name="calendar" size={15} color={colors.textMuted} />
        <Text style={styles.lineText}>
          From {shortDay(startsOn)} · {daysText(offer.days)}
        </Text>
      </View>
      <View style={styles.pay}>
        <Text style={styles.payLabel}>Your pay</Text>
        <Text style={styles.payValue}>{offerText(offer)}</Text>
        <Text style={styles.payWhen}>Cash, {paidWhenText(offer.paidWhen, stageNames)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 6 },
  heading: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  job: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  what: { fontFamily: fonts.medium, fontSize: 14.5, color: colors.text },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lineText: { fontFamily: fonts.body, fontSize: 13.5, color: colors.textMuted },
  pay: { marginTop: 6, backgroundColor: colors.jadeTint, borderRadius: radius.sm, padding: 12, gap: 2 },
  payLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.jade, textTransform: 'uppercase', letterSpacing: 0.5 },
  payValue: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  payWhen: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.text },
});
