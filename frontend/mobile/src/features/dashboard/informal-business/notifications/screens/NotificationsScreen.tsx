import { Feather } from '@expo/vector-icons';
import { Fragment, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/shared/components/Button';
import { Card, IconTile } from '@/shared/components/Parts';
import { BackButton, Screen } from '@/shared/components/Screen';
import { Sheet } from '@/shared/components/Sheet';
import { Tabs } from '@/shared/components/Tabs';
import { Overline } from '@/shared/components/Text';
import { colors, fonts } from '@/shared/theme/tokens';

import { linkLabel, openLink } from '../lib/links';
import { ago, groupOf, loadMore, loadTab, markAllRead, markRead, usePoll, useTab, useUnread } from '../lib/notificationStore';
import type { AppNotification, NotificationTab } from '../types';

const EMPTY: Record<NotificationTab, string> = {
  orders: 'Nothing yet. Order updates show up here.',
  inbox: 'Nothing yet. Jobs, partners and your account show up here.',
};

/**
 * Alerts from the server in two tabs, Orders and Inbox (CONTRACT_notifications
 * section 6). Tap one to read it in full (that marks it read) and open what
 * it's about; "Mark all read" is the tab you're on.
 */
export default function Notifications() {
  usePoll();
  const unread = useUnread();
  const [tab, setTab] = useState<NotificationTab>(unread.orders === 0 && unread.inbox > 0 ? 'inbox' : 'orders');
  const list = useTab(tab);
  const [open, setOpen] = useState<AppNotification | null>(null);
  const [failure, setFailure] = useState('');

  useEffect(() => {
    if (!list.loaded && !list.loading) void loadTab(tab);
  }, [tab, list.loaded, list.loading]);

  const count = tab === 'orders' ? unread.orders : unread.inbox;

  return (
    <Screen onRefresh={() => void loadTab(tab)} refreshing={list.loading && list.loaded}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.title}>Notifications</Text>
        <Pressable
          accessibilityRole="button"
          disabled={count === 0}
          onPress={() => markAllRead(tab).catch(() => setFailure("Couldn't mark them read. Try again."))}
          hitSlop={8}>
          <Text style={[styles.markAll, count === 0 && styles.markAllOff]}>Mark all read</Text>
        </Pressable>
      </View>

      <Tabs<NotificationTab>
        tabs={[
          { key: 'orders', label: 'Orders', badge: unread.orders },
          { key: 'inbox', label: 'Inbox', badge: unread.inbox },
        ]}
        value={tab}
        onChange={setTab}
      />
      {failure ? <Text style={styles.failure}>{failure}</Text> : null}

      {list.failed && list.items.length === 0 ? (
        <Card style={styles.center}>
          <IconTile name="wifi-off" size={44} />
          <Text style={styles.muted}>Couldn&apos;t load your notifications. Check your connection.</Text>
          <Button title="Try again" variant="secondary" onPress={() => void loadTab(tab)} />
        </Card>
      ) : !list.loaded ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : list.items.length === 0 ? (
        <Card style={styles.center}>
          <IconTile name="bell" size={44} />
          <Text style={styles.muted}>{EMPTY[tab]}</Text>
        </Card>
      ) : (
        list.items.map((n, i) => {
          const group = groupOf(n.createdAt);
          const showGroup = i === 0 || groupOf(list.items[i - 1]!.createdAt) !== group;
          return (
            <Fragment key={n.id}>
              {showGroup ? <Overline>{group}</Overline> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${n.readAt ? '' : 'Unread. '}${n.title}. ${n.body}`}
                onPress={() => {
                  setOpen(n);
                  void markRead(n);
                }}>
                <Card style={n.readAt ? undefined : styles.unread}>
                  <View style={styles.row}>
                    <IconTile
                      name={n.icon as keyof typeof Feather.glyphMap}
                      tint={n.readAt ? colors.iconTile : colors.marigoldTint}
                      color={n.readAt ? colors.ink : colors.marigoldDeep}
                    />
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={styles.nTitle}>{n.title}</Text>
                      <Text style={styles.nBody} numberOfLines={2}>
                        {n.body}
                      </Text>
                      <Text style={styles.nWhen}>{ago(n.createdAt)}</Text>
                    </View>
                  </View>
                </Card>
              </Pressable>
            </Fragment>
          );
        })
      )}

      {list.nextBefore ? <Button title={list.loading ? 'Loading…' : 'Show older'} variant="secondary" onPress={() => void loadMore(tab)} /> : null}

      {open ? (
        <NotificationSheet
          n={open}
          onClose={() => setOpen(null)}
          onOpenLink={() => {
            setOpen(null);
            openLink(open.link);
          }}
        />
      ) : null}
    </Screen>
  );
}

/** The whole alert, and a button to what it's about. */
function NotificationSheet({ n, onClose, onOpenLink }: { n: AppNotification; onClose: () => void; onOpenLink: () => void }) {
  const label = linkLabel(n.link);
  return (
    <Sheet visible onClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.row}>
          <IconTile name={n.icon as keyof typeof Feather.glyphMap} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.sheetTitle}>{n.title}</Text>
            <Text style={styles.nWhen}>{ago(n.createdAt)}</Text>
          </View>
        </View>
        <Text style={styles.sheetBody}>{n.body}</Text>
        {label ? <Button title={label} onPress={onOpenLink} /> : null}
        <Button title="Close" variant="secondary" onPress={onClose} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1, fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  markAll: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  markAllOff: { color: colors.textFaint },
  failure: { fontFamily: fonts.medium, fontSize: 13, color: colors.garnet },
  loading: { paddingVertical: 40, alignItems: 'center' },
  center: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  muted: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.textMuted, textAlign: 'center' },
  unread: { borderLeftWidth: 3, borderLeftColor: colors.marigoldDeep },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  nTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  nBody: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, color: colors.textMuted },
  nWhen: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textFaint },
  sheet: { gap: 14, paddingHorizontal: 20, paddingBottom: 12 },
  sheetTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  sheetBody: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.text },
});
