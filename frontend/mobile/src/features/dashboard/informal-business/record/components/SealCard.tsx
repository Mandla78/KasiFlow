import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useSession } from '@/features/auth/session/SessionProvider';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Parts';
import { Overline } from '@/shared/components/Text';
import { colors, fonts } from '@/shared/theme/tokens';

import { recordApi } from '../api/recordApi';
import { checkView, sealedLine, signatureChips, type CheckView } from '../lib/seal';
import { loadSeal, saveSeal } from '../lib/sealStore';
import type { RecordSeal } from '../types';

/**
 * Seal my record / check my record. The server fingerprints every record
 * in the tools and signs the lot twice (Ed25519 and ML-DSA-65, which is
 * post-quantum); this phone keeps the seal. "Check" shows whether anything
 * sealed has changed since -- even on our side.
 */
export function SealCard() {
  const { profile } = useSession();
  const account = profile.email || 'me';
  const [seal, setSeal] = useState<RecordSeal | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<'seal' | 'check' | null>(null);
  const [result, setResult] = useState<CheckView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadSeal(account).then((s) => {
      if (!live) return;
      setSeal(s);
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, [account]);

  const doSeal = async () => {
    setBusy('seal');
    setError(null);
    setResult(null);
    try {
      const s = await recordApi.seal();
      saveSeal(account, s);
      setSeal(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't seal your record. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const doCheck = async () => {
    if (!seal) return;
    setBusy('check');
    setError(null);
    try {
      setResult(checkView(await recordApi.check(seal)));
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "Couldn't check your record. Try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ gap: 6 }}>
      <View style={styles.head}>
        <Overline>Sealed record</Overline>
        <Text style={styles.note}>Post-quantum signed</Text>
      </View>
      <Card style={styles.card}>
        {!loaded ? (
          <ActivityIndicator color={colors.accent} />
        ) : seal ? (
          <>
            <View style={styles.row}>
              <Feather name="lock" size={16} color={colors.ink} />
              <Text style={styles.strong}>{sealedLine(seal)}</Text>
            </View>
            <View style={styles.chips}>
              {signatureChips(seal.alg).map((c) => (
                <Text key={c} style={styles.chip}>
                  {c}
                </Text>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.body}>
            Seal your record: every entry in your tools gets a fingerprint, and we sign the lot twice, once with a post-quantum signature.
            You keep the seal. If anything you sealed changes later, even on our side, the check shows it.
          </Text>
        )}

        {result ? (
          <View style={[styles.result, result.tone === 'warn' ? styles.warn : styles.ok]} accessibilityLiveRegion="polite">
            <Text style={[styles.resultTitle, { color: result.tone === 'warn' ? colors.marigoldDeep : colors.jade }]}>{result.title}</Text>
            {result.lines.map((l) => (
              <Text key={l} style={styles.body}>
                {l}
              </Text>
            ))}
          </View>
        ) : null}
        {error ? <Text style={[styles.body, { color: colors.marigoldDeep }]}>{error}</Text> : null}

        {loaded && seal ? (
          <>
            <Button title="Check my record" onPress={doCheck} loading={busy === 'check'} disabled={busy !== null} />
            <Pressable accessibilityRole="button" onPress={doSeal} disabled={busy !== null} hitSlop={8} style={styles.again}>
              <Text style={styles.againText}>{busy === 'seal' ? 'Sealing…' : 'Seal again (replaces this seal)'}</Text>
            </Pressable>
          </>
        ) : loaded ? (
          <Button title="Seal my record" onPress={doSeal} loading={busy === 'seal'} disabled={busy !== null} />
        ) : null}
        <Text style={styles.fine}>A seal shows your records haven&apos;t changed since you sealed them. It doesn&apos;t make them proof of payment.</Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  note: { fontFamily: fonts.medium, fontSize: 12, color: colors.textFaint },
  card: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  strong: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.accentDeep, backgroundColor: colors.accentTint, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  body: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted },
  result: { borderRadius: 12, padding: 12, gap: 4 },
  ok: { backgroundColor: colors.jadeTint },
  warn: { backgroundColor: colors.marigoldTint },
  resultTitle: { fontFamily: fonts.bold, fontSize: 14 },
  again: { alignSelf: 'center', paddingVertical: 4 },
  againText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textMuted },
  fine: { fontFamily: fonts.body, fontSize: 11.5, lineHeight: 16, color: colors.textFaint },
});
