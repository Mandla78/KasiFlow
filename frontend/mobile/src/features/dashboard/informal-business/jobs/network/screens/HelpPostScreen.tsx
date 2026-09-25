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
import { pickedText } from '../lib/contact';
import { neededText, postDetails } from '../lib/postText';
import { kmText, stagesText } from '../lib/recommend';
import type { BuilderCard, HelpPost } from '../types';

const REFRESH_MS = 4000;
const openBuilder = (id: string) => router.push({ pathname: '/informal-business/jobs/builders/[builderId]', params: { builderId: id } });

/**
 * A help post. Yours: who's interested (with their proof and work), pick
 * one, then WhatsApp or call them. Someone else's: who posted it, and
 * "I'm interested".
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
        <Text style={styles.muted}>{postDetails(post)}</Text>
      </View>

      {error ? <InfoNote icon="alert-circle">{error}</InfoNote> : null}

      {post.mine ? (
        <>
          {picked && picked.builder.phone ? (
            <Card style={{ gap: 12 }}>
              <View style={styles.pickedHead}>
                <Feather name="check-circle" size={18} color={colors.jade} />
                <Text style={styles.pickedText}>You picked {picked.builder.name}. Send the details:</Text>
              </View>
              <ContactButtons name={picked.builder.name} phone={picked.builder.phone} message={pickedText(picked.builder.name, me, post)} />
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
                    line={`${stagesText(r.builder.confirmedStages)} · ${kmText(r.builder.distanceKm)}`}
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

          <InfoNote icon="shield">Only who you pick gets your number, and you get theirs. The post closes after 7 days.</InfoNote>

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
                  line={`${stagesText(post.owner.confirmedStages)}`}
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
            <InfoNote icon="shield">Saying you&apos;re interested shares your builder profile, not your number. Numbers are shared only if you&apos;re picked.</InfoNote>
          )}
        </>
      )}

      {picking ? (
        <ConfirmSheet
          visible
          title={`Pick ${picking.name.split(' ')[0]}?`}
          message={`You both get each other's number, and the post closes.`}
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
  test: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', minHeight: 32 },
  testText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.accentDeep },
});
