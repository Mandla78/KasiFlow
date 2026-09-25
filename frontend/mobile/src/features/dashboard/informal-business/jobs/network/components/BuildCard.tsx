import { Feather } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '@/shared/theme/tokens';

import { listText } from '../lib/pay';
import { dateText } from '../lib/postText';
import type { Build } from '../types';

/**
 * One finished job in a builder's portfolio: its cover photo, where and
 * when, how many stages the client confirmed, and who built it with them.
 * Tap for the slideshow of its stages.
 */
export function BuildCard({ build, onPress }: { build: Build; onPress: () => void }) {
  const cover = build.photos[0];
  const all = build.stagesConfirmed === build.stagesTotal;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${build.title}, ${build.suburb}. Open the photos`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}>
      {cover ? <Image source={cover.photo} style={styles.cover} resizeMode="cover" /> : null}
      {build.photos.length > 1 ? (
        <View style={styles.count}>
          <Feather name="image" size={12} color={colors.white} />
          <Text style={styles.countText}>{build.photos.length}</Text>
        </View>
      ) : null}
      <View style={styles.body}>
        <Text style={styles.title}>{build.title}</Text>
        <Text style={styles.detail}>
          {build.suburb} · {dateText(build.finishedAt)}
        </Text>
        <View style={styles.proof}>
          <Feather name="check-circle" size={14} color={colors.jade} />
          <Text style={styles.proofText}>
            {all ? `${build.stagesTotal} of ${build.stagesTotal} stages confirmed by the client` : `${build.stagesConfirmed} of ${build.stagesTotal} stages confirmed`}
          </Text>
        </View>
        {build.builtWith.length ? <Text style={styles.with}>Built with {listText(build.builtWith)}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  cover: { width: '100%', height: 180, backgroundColor: colors.line },
  count: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.overlay,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  countText: { fontFamily: fonts.bold, fontSize: 12, color: colors.white },
  body: { padding: 12, gap: 3 },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  detail: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted },
  proof: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  proofText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.jade },
  with: { fontFamily: fonts.semibold, fontSize: 13, color: colors.accentDeep },
});
