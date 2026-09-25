import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, radius } from '@/shared/theme/tokens';

import { useAddressSearch } from '../hooks';
import { geocodingApi } from '../services/geocodingApi';
import type { LatLng } from '../types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onPicked: (c: LatLng) => void;
  /** Not found? Go to the map and place the pin by hand. */
  onPinInstead: () => void;
};

/**
 * Search is its own screen, not a bar squeezed above the map (TruConnect's
 * live testing: the dropdown fought the map for space). Picking a result
 * hands its coordinates to the map, where the pin can still be adjusted.
 */
export function SearchAddressModal({ visible, onClose, onPicked, onPinInstead }: Props) {
  const { query, setQuery, suggestions, loading, sessionToken } = useAddressSearch();

  async function pick(id: string) {
    try {
      const c = await geocodingApi.retrieve(id, sessionToken.current);
      setQuery('');
      onPicked(c);
    } catch {
      // Keep the list open; the map ("Use my location") is always a way through.
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close" style={styles.close}>
            <Feather name="x" size={20} color={colors.ink} />
          </Pressable>
          <Text style={styles.title}>Search your address</Text>
        </View>
        <View style={styles.search}>
          <Feather name="search" size={16} color={colors.textMuted} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Street, area or landmark"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
          />
          {loading ? <ActivityIndicator color={colors.ink} /> : null}
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, gap: 4 }}>
          {suggestions.map((s) => (
            <Pressable key={s.id} onPress={() => pick(s.id)} style={styles.row}>
              <Feather name="map-pin" size={16} color={colors.ink} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{s.name}</Text>
                {s.fullAddress ? <Text style={styles.full}>{s.fullAddress}</Text> : null}
              </View>
            </Pressable>
          ))}
          {query.trim() && !loading && suggestions.length === 0 ? (
            <Text style={styles.empty}>No matches. Many township stands aren&apos;t on maps yet: place the pin yourself.</Text>
          ) : null}
          {query.trim() && !loading ? (
            // Always offered: the address may exist but not be on the map.
            <Pressable onPress={onPinInstead} style={styles.row}>
              <Feather name="crosshair" size={16} color={colors.ink} />
              <Text style={styles.name}>Place the pin myself on the map</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.porcelain },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, paddingBottom: 12 },
  close: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  search: {
    marginHorizontal: 20,
    marginBottom: 12,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.ink,
    paddingHorizontal: 14,
  },
  input: { flex: 1, height: '100%', fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  name: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  full: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, paddingVertical: 16 },
});
