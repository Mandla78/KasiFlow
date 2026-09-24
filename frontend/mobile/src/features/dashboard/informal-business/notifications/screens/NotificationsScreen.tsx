import { Feather } from '@expo/vector-icons';
import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, IconTile } from '@/shared/components/Parts';
import { BackButton, Screen } from '@/shared/components/Screen';
import { Overline } from '@/shared/components/Text';
import { notifications } from '../mock';
import { colors, fonts } from '@/shared/theme/tokens';

/** Deliveries, payments, who pays today, record views. */
export default function Notifications() {
  return (
    <Screen>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.title}>Notifications</Text>
        <Text style={styles.markAll}>Mark all read</Text>
      </View>
      {notifications.map((n, i) => {
        // A group heading above the first notification of each group.
        const showGroup = i === 0 || notifications[i - 1].group !== n.group;
        return (
          <Fragment key={n.id}>
            {showGroup ? <Overline>{n.group}</Overline> : null}
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
                  <Text style={styles.nWhen}>{n.when}</Text>
                </View>
              </View>
            </Card>
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
