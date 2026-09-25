import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { ComponentProps, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useSession } from '@/features/auth/session/SessionProvider';
import { ApiError } from '@/shared/api/client';
import { Button } from '@/shared/components/Button';
import { Card, IconTile, InfoNote, Tag } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { Money, Overline, Title } from '@/shared/components/Text';
import { formatRand } from '@/shared/lib/money';
import { colors, fonts } from '@/shared/theme/tokens';

import { BIN_READY, creditBookApi } from '../api/creditBookApi';
import { BinConfirmSheet } from '../components/BinConfirmSheet';
import { CorrectionSheet } from '../components/CorrectionSheet';
import { PhoneSheet } from '../components/PhoneSheet';
import { RepaymentSheet } from '../components/RepaymentSheet';
import { DueTone, dueLabel, shortDate, todayIso } from '../lib/dueDates';
import { formatPhone, openWhatsApp, reminderText } from '../lib/whatsapp';
import { CreditEntryDetail, HistoryItem } from '../types';

type IconName = ComponentProps<typeof Feather>['name'];

/** One entry: what's left, where it came from, and the three things you can do with it. */
export default function EntryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useSession();
  const [entry, setEntry] = useState<CreditEntryDetail | null>(null);
  const [failure, setFailure] = useState<'missing' | 'network' | null>(null);
  const [sheet, setSheet] = useState<'repay' | 'correct' | 'phone' | 'bin' | null>(null);
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const today = todayIso();

  useEffect(() => {
    let live = true;
    creditBookApi
      .get(id ?? '')
      .then((e) => live && setEntry(e))
      .catch((e) => live && setFailure(e instanceof ApiError && e.status === 404 ? 'missing' : 'network'));
    return () => {
      live = false;
    };
  }, [id, attempt]);

  function retry() {
    setFailure(null);
    setAttempt((n) => n + 1);
  }

  function saved(next: CreditEntryDetail, text: string) {
    setEntry(next);
    setSheet(null);
    setNote({ text, ok: true });
  }

  async function remind() {
    if (!entry?.customer?.phone) return;
    const opened = await openWhatsApp(entry.customer.phone, reminderText(entry, profile.businessName, today));
    if (!opened) setNote({ text: "Couldn't open WhatsApp on this phone.", ok: false });
  }

  if (failure) {
    return (
      <Screen back>
        <Card style={styles.center}>
          <IconTile name={failure === 'missing' ? 'search' : 'wifi-off'} size={44} />
          <Text style={styles.muted}>
            {failure === 'missing' ? "We couldn't find that entry." : "Couldn't open this entry. Check your connection and try again."}
          </Text>
          {failure === 'network' ? <Button title="Try again" variant="secondary" onPress={retry} /> : null}
        </Card>
      </Screen>
    );
  }

  if (!entry) {
    return (
      <Screen back>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </Screen>
    );
  }

  const open = entry.status === 'open';
  const due = dueLabel(entry.dueOn, today);
  const phone = entry.customer.phone;
  const history = [...entry.history].reverse();

  return (
    <Screen
      back
      footer={
        open ? (
          <>
            <Button title="Record repayment" icon="check" onPress={() => setSheet('repay')} />
            {phone ? <Button title="Remind on WhatsApp" icon="message-circle" variant="secondary" onPress={remind} /> : null}
          </>
        ) : null
      }>
      <View style={styles.head}>
        <Title style={{ flex: 1 }} numberOfLines={2}>
          {entry.customer.name}
        </Title>
        <StatusTag entry={entry} tone={due.tone} text={due.text} />
      </View>

      {note ? (
        <InfoNote icon={note.ok ? 'check-circle' : 'alert-circle'} tone={note.ok ? 'ok' : 'info'}>
          {note.text}
        </InfoNote>
      ) : null}

      <Card style={{ gap: 14 }}>
        <View>
          <Text style={styles.label}>{entry.status === 'cancelled' ? 'Cancelled' : open ? 'Still owed to you' : 'Paid back'}</Text>
          <Money>{formatRand(open ? entry.outstandingCents : entry.amountCents)}</Money>
          {open && entry.paidCents > 0 ? (
            <Text style={styles.muted2}>
              {formatRand(entry.paidCents)} of {formatRand(entry.amountCents)} paid back
            </Text>
          ) : null}
        </View>
        <Fact label="Given on" value={shortDate(entry.givenOn, today)} />
        <Fact label="Pays back on" value={shortDate(entry.dueOn, today)} />
        {entry.description ? <Fact label="What they took" value={entry.description} /> : null}
        {phone ? (
          <Fact label="Cellphone" value={formatPhone(phone)} />
        ) : (
          <Pressable accessibilityRole="button" onPress={() => setSheet('phone')} style={styles.addPhone}>
            <Feather name="message-circle" size={15} color={colors.accentDeep} />
            <Text style={styles.addPhoneText}>Add a cellphone for WhatsApp reminders</Text>
          </Pressable>
        )}
      </Card>

      {entry.status !== 'cancelled' ? (
        <Pressable accessibilityRole="button" onPress={() => setSheet('correct')} style={styles.correct}>
          <Feather name="edit-3" size={15} color={colors.ink} />
          <Text style={styles.correctText}>Correct this entry</Text>
        </Pressable>
      ) : null}

      <Overline>History</Overline>
      <Card style={{ paddingVertical: 0 }}>
        {history.map((h, i) => (
          <HistoryRow key={h.id} item={h} today={today} last={i === history.length - 1} />
        ))}
      </Card>
      <Text style={styles.footnote}>Mistakes are corrected, and the history keeps both. Moving an entry to the bin only hides it from you.</Text>
      {BIN_READY ? (
        <Pressable accessibilityRole="button" onPress={() => setSheet('bin')} style={styles.correct}>
          <Feather name="trash-2" size={15} color={colors.garnet} />
          <Text style={[styles.correctText, { color: colors.garnet }]}>Move to the bin</Text>
        </Pressable>
      ) : null}

      {sheet === 'repay' ? (
        <RepaymentSheet
          entry={entry}
          today={today}
          onClose={() => setSheet(null)}
          onSaved={(next) =>
            saved(next, next.status === 'paid' ? 'All paid back. This entry is settled.' : `Saved. ${formatRand(next.outstandingCents)} still to go.`)
          }
        />
      ) : null}
      {sheet === 'correct' ? (
        <CorrectionSheet
          entry={entry}
          today={today}
          onClose={() => setSheet(null)}
          onSaved={(next) => saved(next, next.status === 'cancelled' ? 'Entry cancelled. It no longer counts.' : 'Correction saved.')}
        />
      ) : null}
      {sheet === 'phone' ? (
        <PhoneSheet
          customer={entry.customer}
          onClose={() => setSheet(null)}
          onSaved={(c) => saved({ ...entry, customer: { ...entry.customer, phone: c.phone } }, `Saved. You can now remind ${c.name} on WhatsApp.`)}
        />
      ) : null}
      {sheet === 'bin' ? (
        <BinConfirmSheet
          title={`Delete ${entry.customer.name}'s entry?`}
          keeps={entry.paidCents > 0 ? `The ${formatRand(entry.paidCents)} paid back stays in your record.` : undefined}
          onClose={() => setSheet(null)}
          onConfirm={async () => {
            await creditBookApi.moveToBin(entry.id);
            router.dismissTo({ pathname: '/informal-business/credit-book', params: { binned: entry.id } });
          }}
        />
      ) : null}
    </Screen>
  );
}

function StatusTag({ entry, tone, text }: { entry: CreditEntryDetail; tone: DueTone; text: string }) {
  if (entry.status === 'paid') return <Tag label="Paid back" tone="jade" />;
  if (entry.status === 'cancelled') return <Tag label="Cancelled" tone="muted" />;
  return <Tag label={text} tone={tone === 'late' || tone === 'today' ? 'marigold' : 'muted'} />;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

function describe(h: HistoryItem): { icon: IconName; title: string; detail?: string } {
  switch (h.type) {
    case 'given':
      return { icon: 'shopping-bag', title: `Credit given · ${formatRand(h.amountCents)}` };
    case 'repayment':
      return { icon: 'check', title: `Paid back · ${formatRand(h.amountCents)}` };
    case 'correction': {
      const changes = [
        h.before.amountCents !== h.after.amountCents ? `${formatRand(h.before.amountCents)} → ${formatRand(h.after.amountCents)}` : '',
        h.before.dueOn !== h.after.dueOn ? `due ${shortDate(h.before.dueOn)} → ${shortDate(h.after.dueOn)}` : '',
        h.before.description !== h.after.description ? `"${h.before.description || '—'}" → "${h.after.description || '—'}"` : '',
      ].filter(Boolean);
      return { icon: 'edit-3', title: 'Corrected', detail: [changes.join(', '), h.reason].filter(Boolean).join(' · ') };
    }
    case 'cancelled':
      return { icon: 'x', title: 'Cancelled', detail: h.reason || undefined };
  }
}

function HistoryRow({ item, today, last }: { item: HistoryItem; today: string; last: boolean }) {
  const d = describe(item);
  return (
    <View style={[styles.hRow, !last && styles.rule]}>
      <IconTile name={d.icon} size={32} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.hTitle}>{d.title}</Text>
        {d.detail ? <Text style={styles.hDetail}>{d.detail}</Text> : null}
        <Text style={styles.hMeta}>
          {shortDate(item.on, today)} · Recorded by you
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: 40, alignItems: 'center' },
  center: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  muted: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted, textAlign: 'center' },
  muted2: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textMuted },
  fact: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 },
  factLabel: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textMuted },
  factValue: { flex: 1, textAlign: 'right', fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  addPhone: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12, minHeight: 44 },
  addPhoneText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.accentDeep },
  correct: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, minHeight: 44 },
  correctText: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  hRow: { flexDirection: 'row', gap: 12, paddingVertical: 12 },
  rule: { borderBottomWidth: 1, borderBottomColor: colors.line },
  hTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  hDetail: { fontFamily: fonts.body, fontSize: 13, color: colors.text },
  hMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.textMuted },
  footnote: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, textAlign: 'center' },
});
