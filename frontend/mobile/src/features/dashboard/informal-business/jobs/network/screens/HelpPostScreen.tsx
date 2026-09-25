import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useSession } from '@/features/auth/session/SessionProvider';
import { ApiError } from '@/shared/api/client';
import { Button } from '@/shared/components/Button';
import { Card, IconTile, InfoNote, Tag } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { ConfirmSheet } from '@/shared/components/Sheet';
import { Overline, Title } from '@/shared/components/Text';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { networkApi, SAMPLE_ANSWERS } from '../api/networkApi';
import { ContactButtons } from '../components/ContactButtons';
import { PersonRow } from '../components/PersonRow';
import { ShowMeSheet } from '../components/ShowMeSheet';
import { dealText } from '../lib/contact';
import { offerText, paidWhenText } from '../lib/pay';
import { neededText, postDetails } from '../lib/postText';
import { kmText } from '../lib/recommend';
import type { BuilderCard, HelpPost } from '../types';

const REFRESH_MS = 4000;
const openBuilder = (id: string) => router.push({ pathname: '/informal-business/jobs/builders/[builderId]', params: { builderId: id } });

/**
 * A help post: an offer posted nearby, with the pay. Yours: who's
 * interested (with their builds), pick one and they're your partner on the
 * job, then WhatsApp or call them. Someone else's: who posted it, the pay,
 * and "I'm interested".
 */
export default function HelpPostScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { profile } = useSession();
  const [post, setPost] = useState<HelpPost | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState<BuilderCard | null>(null);
  const [closing, setClosing] = useState(false);
  const [showMe, setShowMe] = useState(false);
  const [error, setError] = useState('');
  const at = profile.location ?? undefined;
  const me = profile.ownerName || profile.businessName;

  const fetchPost = useCallback(() => networkApi.helpPost(postId ?? '', at), [postId, at]);

  // Load, and keep watching your open post for new answers.
  const watching = !!post && post.mine && post.status === 'open';
  useEffect(() => {
    let live = true;
    const refresh = () =>
      fetchPost()
        .then((p) => live && setPost(p))
        .catch(() => live && setFailed(true));
    refresh();
    const timer = watching ? setInterval(refresh, REFRESH_MS) : undefined;
    return () => {
      live = false;
      if (timer) clearInterval(timer);
    };
  }, [fetchPost, watching]);

  async function run(action: () => Promise<HelpPost>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      setPost(await action());
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PROFILE_HIDDEN') setShowMe(true);
      else setError(err instanceof ApiError ? err.message : "Couldn't do that. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!post) {
    return (
      <Screen back>
        {failed ? (
          <Card style={styles.center}>
            <IconTile name="search" size={44} />
            <Text style={styles.muted}>We couldn&apos;t open this post. It may be closed.</Text>
          </Card>
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}
      </Screen>
    );
  }

  const picked = post.responses.find((r) => r.status === 'picked');

  return (
    <Screen
      back
      footer={
        !post.mine && post.status === 'open' && !post.myResponse ? (
          <Button title="I'm interested" icon="thumbs-up" loading={busy} onPress={() => run(() => networkApi.interested(post.id))} />
        ) : undefined
      }>
      <View style={{ gap: 6 }}>
        <View style={styles.titleRow}>
          <Title style={{ flex: 1 }}>{neededText(post.trade)}</Title>
          <Tag
            label={post.status === 'open' ? 'Open' : post.status === 'filled' ? 'Picked' : 'Closed'}
            tone={post.status === 'open' ? 'marigold' : post.status === 'filled' ? 'jade' : 'muted'}
          />
        </View>
        <Text style={styles.what}>{post.what}</Text>
        <Text style={styles.muted}>{postDetails({ ...post, days: post.offer.days })}</Text>
      </View>

      <View style={styles.pay}>
        <Text style={styles.payLabel}>{post.mine ? 'The pay you offered' : 'Your pay'}</Text>
        <Text style={styles.payValue}>{offerText(post.offer)}</Text>
        <Text style={styles.payWhen}>Cash, {paidWhenText(post.offer.paidWhen, [post.what])}</Text>
      </View>

      {error ? <InfoNote icon="alert-circle">{error}</InfoNote> : null}

      {post.mine ? (
        <>
          {picked && picked.builder.phone ? (
            <Card style={{ gap: 12 }}>
              <View style={styles.pickedHead}>
                <Feather name="check-circle" size={18} color={colors.jade} />
                <Text style={styles.pickedText}>{picked.builder.name.split(' ')[0]} is your partner on the job. Send the details:</Text>
              </View>
              <ContactButtons
                name={picked.builder.name}
                phone={picked.builder.phone}
                message={dealText(picked.builder.name, me, { jobTitle: post.jobTitle ?? 'the job', suburb: post.suburb, stageNames: [post.what], startsOn: post.startsOn, offer: post.offer })}
              />
              {post.jobId ? (
                <Button
                  title="Open the job"
                  variant="secondary"
                  onPress={() => router.dismissTo({ pathname: '/informal-business/jobs/[id]', params: { id: post.jobId! } })}
                />
              ) : null}
            </Card>
          ) : null}

          <View style={styles.section}>
            <Overline>{post.responses.length ? `Interested (${post.responses.length})` : 'Interested'}</Overline>
            {post.responses.length ? (
              <Card style={{ paddingVertical: 0 }}>
                {post.responses.map((r, i) => (
                  <PersonRow
                    key={r.builder.id}
                    builder={r.builder}
                    line={`${r.builder.buildsConfirmed} builds confirmed · ${kmText(r.builder.distanceKm)}`}
                    onOpen={() => openBuilder(r.builder.id)}
                    last={i === post.responses.length - 1}
                    right={
                      r.status === 'picked' ? (
                        <Tag label="Picked" tone="jade" />
                      ) : post.status === 'open' ? (
                        <Pressable accessibilityRole="button" accessibilityLabel={`Pick ${r.builder.name}`} onPress={() => setPicking(r.builder)} style={styles.pick}>
                          <Text style={styles.pickText}>Pick</Text>
                        </Pressable>
                      ) : null
                    }
                  />
                ))}
              </Card>
            ) : (
              <Card style={styles.center}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.muted}>Waiting for builders. Anyone interested shows up here; tap them to see their work.</Text>
              </Card>
            )}
            {SAMPLE_ANSWERS && post.status === 'open' ? (
              <View style={styles.test}>
                <Feather name="smartphone" size={14} color={colors.accentDeep} />
                <Text style={styles.testText}>Test: sample builders answer a few seconds after you post.</Text>
              </View>
            ) : null}
          </View>

          <InfoNote icon="shield">Who you pick becomes your partner on the job, on this pay; you get each other&apos;s number. The post closes after 7 days.</InfoNote>

          {post.status === 'open' ? <Button title="Close this post" variant="secondary" onPress={() => setClosing(true)} /> : null}
        </>
      ) : (
        <>
          {post.owner ? (
            <View style={styles.section}>
              <Overline>Posted by</Overline>
              <Card style={{ paddingVertical: 0 }}>
                <PersonRow
                  builder={post.owner}
                  line={`${post.owner.buildsConfirmed} builds confirmed by clients`}
                  onOpen={() => openBuilder(post.owner!.id)}
                  last
                  right={<Feather name="chevron-right" size={18} color={colors.textFaint} />}
                />
              </Card>
            </View>
          ) : null}
          {post.myResponse ? (
            <InfoNote icon="check-circle" tone="ok">
              You&apos;re interested. {post.owner?.name.split(' ')[0] ?? 'They'} sees your work and proof. If they pick you, you both get each other&apos;s number.
            </InfoNote>
          ) : (
            <InfoNote icon="shield">Saying you&apos;re interested shares your builds, not your number. If you&apos;re picked, you join the job on this pay and get each other&apos;s number.</InfoNote>
          )}
        </>
      )}

      {picking ? (
        <ConfirmSheet
          visible
          title={`Pick ${picking.name.split(' ')[0]}?`}
          message={`They join the job on the pay you posted. You both get each other's number, and the post closes.`}
          confirmLabel={`Pick ${picking.name.split(' ')[0]}`}
          onCancel={() => setPicking(null)}
          onConfirm={() => {
            const id = picking.id;
            setPicking(null);
            run(() => networkApi.pick(post.id, id));
          }}
        />
      ) : null}
      {closing ? (
        <ConfirmSheet
          visible
          title="Close this post?"
          message="Builders stop seeing it. You can post again from the job."
          confirmLabel="Close it"
          onCancel={() => setClosing(false)}
          onConfirm={() => {
            setClosing(false);
            run(() => networkApi.closeHelpPost(post.id));
          }}
        />
      ) : null}
      {showMe ? <ShowMeSheet onClose={() => setShowMe(false)} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: 40, alignItems: 'center' },
  center: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  muted: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted, textAlign: 'left' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  what: { fontFamily: fonts.semibold, fontSize: 15.5, color: colors.text },
  section: { gap: 8 },
  pickedHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pickedText: { flex: 1, fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  pick: { height: 38, minWidth: 72, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  pickText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.white },
  pay: { backgroundColor: colors.jadeTint, borderRadius: radius.sm, padding: 12, gap: 2 },
  payLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.jade, textTransform: 'uppercase', letterSpacing: 0.5 },
  payValue: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  payWhen: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.text },
  test: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', minHeight: 32 },
  testText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.accentDeep },
});
