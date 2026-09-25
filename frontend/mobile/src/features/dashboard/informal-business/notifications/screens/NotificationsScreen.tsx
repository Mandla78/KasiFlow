import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, IconTile } from '@/shared/components/Parts';
import { BackButton, Screen } from '@/shared/components/Screen';
import { Overline } from '@/shared/components/Text';
import { ago, groupOf, markAllRead, markRead, useNotifications } from '../lib/notificationStore';
import { colors, fonts } from '@/shared/theme/tokens';

/** Orders, deliveries, payments, who pays today, record views. */
export default function Notifications() {
  const notifications = useNotifications();
  return (
    <Screen>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.title}>Notifications</Text>
        <Text style={styles.markAll} onPress={markAllRead} accessibilityRole="button">
          Mark all read
        </Text>
      </View>
      {notifications.map((n, i) => {
        // A group heading above the first notification of each group.
        const group = groupOf(n.at);
        const showGroup = i === 0 || groupOf(notifications[i - 1].at) !== group;
        return (
          <Fragment key={n.id}>
            {showGroup ? <Overline>{group}</Overline> : null}
            <Pressable
              disabled={!n.href && !n.unread}
              onPress={() => {
                markRead(n.id);
                if (n.href) router.push(n.href as never);
              }}>
            <Card style={n.unread ? styles.unread : undefined}>
              <View style={styles.row}>
                <IconTile
                  name={n.icon as keyof typeof Feather.glyphMap}
                  tint={n.unread ? colors.marigoldTint : colors.iconTile}
                  color={n.unread ? colors.marigoldDeep : colors.ink}
                />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.nTitle}>{n.title}</Text>
                  <Text style={styles.nBody}>{n.body}</Text>
                  <Text style={styles.nWhen}>{ago(n.at)}</Text>
                </View>
              </View>
            </Card>
            </Pressable>
          </Fragment>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1, fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  markAll: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  unread: { borderLeftWidth: 3, borderLeftColor: colors.marigoldDeep },
  row: { flexDirection: 'row', gap: 12 },
  nTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  nBody: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, color: colors.textMuted },
  nWhen: { fontFamily: fonts.body, fontSize: 11.5, color: colors.textFaint },
});
