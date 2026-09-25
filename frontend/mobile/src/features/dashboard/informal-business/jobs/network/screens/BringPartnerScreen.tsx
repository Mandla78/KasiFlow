import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { areaOf } from '@/features/auth/profile';
import { useSession } from '@/features/auth/session/SessionProvider';
import { AmountField } from '@/features/dashboard/informal-business/credit-book/components/AmountField';
import { parseRand } from '@/features/dashboard/informal-business/credit-book/lib/amounts';
import { ApiError } from '@/shared/api/client';
import { Button } from '@/shared/components/Button';
import { Card, InfoNote } from '@/shared/components/Parts';
import { BackButton, Screen } from '@/shared/components/Screen';
import { ConfirmSheet } from '@/shared/components/Sheet';
import { Overline, Title } from '@/shared/components/Text';
import { formatRand } from '@/shared/lib/money';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { jobsApi } from '../../api/jobsApi';
import type { Job } from '../../types';
import { networkApi } from '../api/networkApi';
import { BuilderRow } from '../components/BuilderRow';
import { OfferCard } from '../components/OfferCard';
import { ShowMeSheet } from '../components/ShowMeSheet';
import { MAX_POST_DAYS } from '../lib/limits';
import { checkOffer, keepLine, listText } from '../lib/pay';
import { daysText, startChoices } from '../lib/postText';
import { TRADES, tradeLabel, type Trade } from '../lib/trades';
import type { BuilderCard, BuilderProfile, Candidates, NewOffer, Offer, PaidWhen, PayKind } from '../types';

/** The job's place, cut to its suburb: "Tembisa, Ext 5" -> "Tembisa". Never the street. */
function suburbOf(place: string): string {
  return place.split(',')[0]?.trim() ?? '';
}

/**
 * Bring in a partner (DECISION_jobs_partners.txt). First the offer: which
 * stages, the trade, when, and their pay (fixed or per day, and when it's
 * paid), with a private line of what you keep. Then who: your partners,
 * builders you saved, or builders near the job of that trade; or post it
 * nearby. The partner sees the offer before they accept, like a driver
 * sees the fare. Opened from a builder's profile, that builder is picked.
 */
export default function BringPartnerScreen() {
  const { id, builderId } = useLocalSearchParams<{ id: string; builderId?: string }>();
  const { profile } = useSession();
  const at = profile.location ?? undefined;
  const [job, setJob] = useState<Job | null>(null);
  const [chosen, setChosen] = useState<BuilderProfile | null>(null);
  const [failed, setFailed] = useState(false);
  const [step, setStep] = useState<'offer' | 'who'>('offer');

  const [stageIds, setStageIds] = useState<string[]>([]);
  const [trade, setTrade] = useState<Trade | null>(null);
  const days = startChoices();
  const [startsOn, setStartsOn] = useState(days[1]!.iso);
  const [length, setLength] = useState(2);
  const [kind, setKind] = useState<PayKind>('fixed');
  const [amount, setAmount] = useState('');
  const [paidWhen, setPaidWhen] = useState<PaidWhen>('stage_confirmed');

  const [who, setWho] = useState<Candidates | null>(null);
  const [inviting, setInviting] = useState<BuilderCard | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showMe, setShowMe] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([jobsApi.get(id ?? ''), builderId ? networkApi.builder(builderId, at) : Promise.resolve(null)])
      .then(([j, b]) => {
        if (!live) return;
        setJob(j);
        if (b) {
          setChosen(b);
          setTrade(b.trades[0] ?? null);
        }
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
    // Loaded once for this job (and builder); the form keeps what's typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, builderId]);

  if (!job) {
    return (
      <Screen back>
        {failed ? (
          <Text style={styles.muted}>We couldn&apos;t open that job.</Text>
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}
      </Screen>
    );
  }

  const open = job.stages.filter((st) => st.status !== 'confirmed');
  const picked = job.stages.filter((st) => stageIds.includes(st.id));
  const stageNames = picked.map((st) => st.name);
  const stagesCents = picked.reduce((sum, st) => sum + st.amountCents, 0);
  const cents = parseRand(amount);
  const offer: Offer | null = cents === null ? null : { kind, amountCents: cents, days: length, paidWhen };
  const offerProblem = offer ? checkOffer(offer) : amount.trim() ? 'Type an amount like 4500' : null;
  const ready = picked.length > 0 && !!trade && !!offer && !offerProblem;
  const keep = ready && offer ? keepLine(stagesCents, stageNames, offer) : null;
  const suburb = suburbOf(job.place) || areaOf(profile);
  const newOffer = (): NewOffer => ({ stageIds, trade: trade!, startsOn, offer: offer! });
  const tradeChoices = chosen ? TRADES.filter((t) => chosen.trades.includes(t.key)) : TRADES;

  function toggleStage(stageId: string) {
    setStageIds((cur) => (cur.includes(stageId) ? cur.filter((x) => x !== stageId) : [...cur, stageId]));
  }

  async function next() {
    if (!ready || !trade) return;
    setError('');
    setStep('who');
    if (!chosen) {
      setWho(null);
      try {
        setWho(await networkApi.candidates(job!.id, trade, at));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Couldn't load builders. Check your connection and try again.");
      }
    }
  }

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && err.code === 'PROFILE_HIDDEN') setShowMe(true);
      else setError(err instanceof ApiError ? err.message : "Couldn't send it. Check your connection and try again.");
    }
  }

  const sendInvite = (b: { id: string }) =>
    run(async () => {
      await networkApi.invite(job.id, b.id, newOffer());
      // To the job, where the partner now shows as invited.
      router.dismissTo({ pathname: '/informal-business/jobs/[id]', params: { id: job.id } });
    });

  const postNearby = () =>
    run(async () => {
      const post = await networkApi.createHelpPost(job.id, { ...newOffer(), suburb });
      router.replace({ pathname: '/informal-business/jobs/help/[postId]', params: { postId: post.id } });
    });

  if (step === 'who' && offer && trade) {
    const first = chosen?.name.split(' ')[0];
    const lists = who
      ? [
          { title: 'Your partners', rows: who.partners },
          { title: 'Saved', rows: who.saved },
          { title: `${tradeLabel(trade)}s near the job`, rows: who.nearby },
        ]
      : [];
    return (
      <Screen footer={chosen ? <Button title={`Send the invite to ${first}`} icon="send" loading={busy} onPress={() => sendInvite(chosen)} /> : undefined}>
        <BackButton onPress={() => setStep('offer')} />
        <Title>{chosen ? `Invite ${first}` : 'Who do you want?'}</Title>
        <OfferCard heading={chosen ? `What ${first} will see` : 'What they will see'} jobTitle={job.title} suburb={suburb} trade={trade} stageNames={stageNames} startsOn={startsOn} offer={offer} />
        <InfoNote icon="shield">They see this offer before they say yes. Numbers are shared only if they accept. Your client&apos;s name, number and price stay with you.</InfoNote>
        {error ? <InfoNote icon="alert-circle">{error}</InfoNote> : null}

        {chosen ? null : !who ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <>
            {lists.map((l) =>
              l.rows.length ? (
                <View key={l.title} style={styles.section}>
                  <Overline>{l.title}</Overline>
                  <Card style={{ paddingVertical: 0 }}>
                    {l.rows.map((b, i) => (
                      <BuilderRow
                        key={b.id}
                        builder={b}
                        last={i === l.rows.length - 1}
                        onOpen={() => router.push({ pathname: '/informal-business/jobs/builders/[builderId]', params: { builderId: b.id } })}
                        right={
                          <Pressable accessibilityRole="button" accessibilityLabel={`Invite ${b.name}`} onPress={() => setInviting(b)} style={styles.invite}>
                            <Text style={styles.inviteText}>Invite</Text>
                          </Pressable>
                        }
                      />
                    ))}
                  </Card>
                </View>
              ) : null,
            )}
            {!who.partners.length && !who.saved.length && !who.nearby.length ? (
              <Text style={styles.muted}>No {tradeLabel(trade).toLowerCase()} near the job yet. Post it nearby, and builders who join will see it.</Text>
            ) : null}
            <View style={styles.section}>
              <Text style={styles.small}>Don&apos;t see the right person?</Text>
              <Button title="Post it nearby instead" icon="radio" variant="secondary" loading={busy && !inviting} onPress={postNearby} />
              <Text style={styles.small}>
                {tradeLabel(trade)}s near {suburb || 'the job'} see the offer for 7 days. You pick from who&apos;s interested.
              </Text>
            </View>
          </>
        )}

        {inviting ? (
          <ConfirmSheet
            visible
            title={`Invite ${inviting.name.split(' ')[0]}?`}
            message={`${inviting.name.split(' ')[0]} sees the offer above and says yes or no. You get each other's number if they accept.`}
            confirmLabel="Send the invite"
            onCancel={() => setInviting(null)}
            onConfirm={() => {
              const b = inviting;
              setInviting(null);
              sendInvite(b);
            }}
          />
        ) : null}
        {showMe ? <ShowMeSheet onClose={() => setShowMe(false)} /> : null}
      </Screen>
    );
  }

  return (
    <Screen back footer={<Button title={chosen ? 'Next: check the invite' : 'Next: choose who'} icon="arrow-right" disabled={!ready} onPress={next} />}>
      <View>
        <Title>Bring in a partner</Title>
        <Text style={styles.sub}>
          {job.title}
          {chosen ? ` · ${chosen.name}` : ''}
        </Text>
      </View>

      <View style={styles.section}>
        <Overline>Which stages will they do?</Overline>
        {open.length ? (
          <View style={styles.wrap}>
            {open.map((st) => {
              const on = stageIds.includes(st.id);
              return (
                <Pressable key={st.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => toggleStage(st.id)} style={[styles.chip, on && styles.chipOn]}>
                  {on ? <Feather name="check" size={14} color={colors.white} /> : null}
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{st.name}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={styles.muted}>Every stage of this job is already confirmed.</Text>
        )}
      </View>

      <View style={styles.section}>
        <Overline>Who do you need?</Overline>
        <View style={styles.wrap}>
          {tradeChoices.map((t) => (
            <Pressable key={t.key} accessibilityRole="radio" accessibilityState={{ checked: trade === t.key }} onPress={() => setTrade(t.key)} style={[styles.chip, trade === t.key && styles.chipOn]}>
              <Text style={[styles.chipText, trade === t.key && styles.chipTextOn]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Overline>Starting</Overline>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.row}>
          {days.map((d) => (
            <Pressable key={d.iso} accessibilityRole="radio" accessibilityState={{ checked: startsOn === d.iso }} onPress={() => setStartsOn(d.iso)} style={[styles.chip, startsOn === d.iso && styles.chipOn]}>
              <Text style={[styles.chipText, startsOn === d.iso && styles.chipTextOn]}>{d.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Overline>For how long?</Overline>
        <View style={styles.stepper}>
          <Pressable accessibilityRole="button" accessibilityLabel="One day less" disabled={length <= 1} onPress={() => setLength((n) => Math.max(1, n - 1))} style={[styles.step, length <= 1 && { opacity: 0.4 }]}>
            <Feather name="minus" size={20} color={colors.ink} />
          </Pressable>
          <Text style={styles.stepValue}>{daysText(length)}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="One day more"
            disabled={length >= MAX_POST_DAYS}
            onPress={() => setLength((n) => Math.min(MAX_POST_DAYS, n + 1))}
            style={[styles.step, length >= MAX_POST_DAYS && { opacity: 0.4 }]}>
            <Feather name="plus" size={20} color={colors.ink} />
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Overline>Their pay</Overline>
        <View style={styles.wrap}>
          {(
            [
              ['fixed', 'One amount'],
              ['per_day', 'Per day'],
            ] as [PayKind, string][]
          ).map(([k, label]) => (
            <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: kind === k }} onPress={() => setKind(k)} style={[styles.chip, kind === k && styles.chipOn]}>
              <Text style={[styles.chipText, kind === k && styles.chipTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <AmountField
          label={kind === 'fixed' ? 'Their pay for the work' : 'Their pay per day'}
          value={amount}
          onChangeText={setAmount}
          error={amount.trim() ? (offerProblem ?? undefined) : undefined}
          hint={kind === 'per_day' && offer && !offerProblem ? `${daysText(length)}: ${formatRand(offer.amountCents * length)} in all` : undefined}
        />
      </View>

      <View style={styles.section}>
        <Overline>Paid in cash</Overline>
        <View style={{ gap: 8 }}>
          {(
            [
              ['stage_confirmed', picked.length ? `When the client confirms ${listText(stageNames)}` : 'When the client confirms the stage'],
              ['daily', 'Every day'],
              ['end', 'At the end of the job'],
            ] as [PaidWhen, string][]
          ).map(([k, label]) => (
            <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: paidWhen === k }} onPress={() => setPaidWhen(k)} style={[styles.option, paidWhen === k && styles.optionOn]}>
              <Text style={styles.optionText}>{label}</Text>
              {paidWhen === k ? <Feather name="check" size={18} color={colors.accentDeep} /> : null}
            </Pressable>
          ))}
        </View>
      </View>

      {keep ? (
        <View style={[styles.keep, keep.loses && styles.keepBad]}>
          <Feather name="lock" size={14} color={keep.loses ? colors.garnet : colors.ink} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.keepText, keep.loses && { color: colors.garnet }]}>{keep.text}</Text>
            <Text style={styles.keepSmall}>Only you see this. Your partner sees their pay, never the client&apos;s price.</Text>
          </View>
        </View>
      ) : null}

      <Text style={styles.small}>Akayza doesn&apos;t hold the money: you pay your partner in cash, and you both confirm each payment here.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: 40, alignItems: 'center' },
  muted: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted },
  small: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, color: colors.textMuted },
  sub: { fontFamily: fonts.body, fontSize: 13.5, color: colors.textMuted, marginTop: 2 },
  section: { gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bleed: { marginHorizontal: -20 },
  row: { paddingHorizontal: 20, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  chipTextOn: { color: colors.white },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  step: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontFamily: fonts.display, fontSize: 20, color: colors.ink, minWidth: 90, textAlign: 'center' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  optionOn: { borderColor: colors.accent, backgroundColor: colors.accentTint },
  optionText: { flex: 1, fontFamily: fonts.semibold, fontSize: 14.5, color: colors.text },
  keep: { flexDirection: 'row', gap: 10, backgroundColor: colors.infoTint, borderRadius: radius.sm, padding: 12 },
  keepBad: { backgroundColor: colors.garnetTint },
  keepText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, color: colors.ink },
  keepSmall: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textMuted, marginTop: 2 },
  invite: { height: 38, minWidth: 72, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  inviteText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.white },
});
