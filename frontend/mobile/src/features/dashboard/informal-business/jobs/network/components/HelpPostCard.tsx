import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Card, Tag } from '@/shared/components/Parts';
import { colors, fonts } from '@/shared/theme/tokens';

import { neededText, postDetails } from '../lib/postText';
import type { HelpPost } from '../types';

/** "Plumber needed · Move a shower drain / Rabie Ridge · 5.7 km · from tomorrow · 1 day". */
export function HelpPostCard({ post, onPress }: { post: HelpPost; onPress: () => void }) {
  const answered = post.responses.length;
  return (
    <Card onPress={onPress} style={{ gap: 6 }}>
      <View style={styles.head}>
        <Feather name="users" size={16} color={colors.accentDeep} />
        <Text style={styles.title} numberOfLines={1}>
          {neededText(post.trade)}
        </Text>
        {post.mine ? (
          <Tag label={post.status === 'filled' ? 'Picked' : answered ? `${answered} interested` : 'Waiting'} tone={post.status === 'filled' ? 'jade' : answered ? 'marigold' : 'muted'} />
        ) : post.myResponse ? (
          <Tag label="You're interested" tone="jade" />
        ) : null}
      </View>
      <Text style={styles.what} numberOfLines={2}>
        {post.what}
      </Text>
      <Text style={styles.details}>
        {post.mine ? '' : `${post.owner?.name.split(' ')[0] ?? ''} · `}
        {postDetails(post)}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontFamily: fonts.bold, fontSize: 15.5, color: colors.text },
  what: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  details: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
});
