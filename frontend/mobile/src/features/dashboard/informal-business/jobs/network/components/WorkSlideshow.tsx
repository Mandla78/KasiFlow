import { Feather } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { FlatList, Image, Modal, NativeScrollEvent, NativeSyntheticEvent, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts } from '@/shared/theme/tokens';

import { dateText } from '../lib/postText';
import type { WorkItem } from '../types';

/**
 * A builder's work, full screen: swipe left and right (or use the arrows),
 * the stage and job under each photo. Mount it only while open.
 */
export function WorkSlideshow({ items, start, name, onClose }: { items: WorkItem[]; start: number; name: string; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(start);
  const list = useRef<FlatList<WorkItem>>(null);
  const item = items[index];

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index && next >= 0 && next < items.length) setIndex(next);
  }

  function go(to: number) {
    if (to < 0 || to >= items.length) return;
    list.current?.scrollToIndex({ index: to, animated: true });
    setIndex(to);
  }

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={styles.page}>
        <View style={styles.top}>
          <Text style={styles.count}>
            {name}&apos;s work · {index + 1} of {items.length}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} onPress={onClose} style={styles.close}>
            <Feather name="x" size={24} color={colors.white} />
          </Pressable>
        </View>

        <FlatList
          ref={list}
          data={items}
          keyExtractor={(w) => w.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={start}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onScroll={onScroll}
          scrollEventThrottle={32}
          renderItem={({ item: w }) => (
            <View style={{ width, height: height * 0.62, justifyContent: 'center' }}>
              <Image source={w.photo} resizeMode="contain" style={{ width, height: '100%' }} accessibilityLabel={`${w.stageName}, ${w.jobTitle}`} />
            </View>
          )}
        />

        {item ? (
          <View style={styles.caption}>
            <Text style={styles.stage}>{item.stageName}</Text>
            <Text style={styles.job}>
              {item.jobTitle} · {item.suburb}
            </Text>
            <View style={styles.confirmed}>
              <Feather name="check-circle" size={14} color={colors.jadeTint} />
              <Text style={styles.confirmedText}>Confirmed by the client · {dateText(item.confirmedAt)}</Text>
            </View>
          </View>
        ) : null}

        {items.length > 1 ? (
          <View style={styles.arrows}>
            <Pressable accessibilityRole="button" accessibilityLabel="Previous photo" disabled={index === 0} onPress={() => go(index - 1)} style={[styles.arrow, index === 0 && styles.off]}>
              <Feather name="chevron-left" size={26} color={colors.white} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next photo"
              disabled={index === items.length - 1}
              onPress={() => go(index + 1)}
              style={[styles.arrow, index === items.length - 1 && styles.off]}>
              <Feather name="chevron-right" size={26} color={colors.white} />
            </Pressable>
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#05070D' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  count: { fontFamily: fonts.semibold, fontSize: 14, color: colors.white, opacity: 0.85 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  caption: { paddingHorizontal: 20, paddingTop: 14, gap: 4 },
  stage: { fontFamily: fonts.display, fontSize: 20, color: colors.white },
  job: { fontFamily: fonts.medium, fontSize: 14.5, color: colors.white, opacity: 0.85 },
  confirmed: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  confirmedText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.jadeTint },
  arrows: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, marginTop: 'auto' },
  arrow: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.3 },
});
