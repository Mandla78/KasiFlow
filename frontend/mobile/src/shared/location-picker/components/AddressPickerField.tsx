import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '@/shared/theme/tokens';

import type { LatLng, PickedPlace } from '../types';
import { MapPickerModal } from './MapPickerModal';
import { SearchAddressModal } from './SearchAddressModal';

type Props = {
  label: string;
  value: PickedPlace | null;
  onChange: (p: PickedPlace) => void;
  mapTitle: string;
  confirmLabel: string;
  error?: string;
};

export function formatPlace(p: PickedPlace): string {
  return [p.building, p.street, p.suburb, p.city].filter((s) => s.trim()).join(', ');
}

/**
 * The entry point: shows the chosen address (tap to adjust the pin, or
 * search a different one), or two ways to set one -- search, or the
 * phone's location on the map. Every way ends on the map, so the pin is
 * always confirmed by the user.
 */
export function AddressPickerField({ label, value, onChange, mapTitle, confirmLabel, error }: Props) {
  const [searching, setSearching] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [preset, setPreset] = useState<LatLng | null>(null);

  const openMap = (c: LatLng | null) => {
    setPreset(c);
    setMapOpen(true);
  };

  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>{label}</Text>
      {value ? (
        <>
          <Pressable onPress={() => openMap({ latitude: value.latitude, longitude: value.longitude })} style={[styles.card, styles.cardSet]}>
            <View style={styles.pinTile}>
              <Feather name="map-pin" size={18} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.addr}>{formatPlace(value)}</Text>
              <Text style={styles.sub}>
                {value.province} · pin set on the map
              </Text>
            </View>
            <Text style={styles.change}>Change</Text>
          </Pressable>
          {/* Moved? "Change" adjusts the pin; this finds a whole new address. */}
          <Pressable onPress={() => setSearching(true)} style={styles.searchAgain} accessibilityRole="button">
            <Feather name="search" size={15} color={colors.ink} />
            <Text style={styles.searchAgainText}>Search a different address</Text>
          </Pressable>
        </>
      ) : (
        <View style={styles.actions}>
          <Pressable onPress={() => setSearching(true)} style={[styles.card, error ? { borderColor: colors.garnet } : null]}>
            <Feather name="search" size={18} color={colors.ink} />
            <Text style={styles.action}>Search your address</Text>
          </Pressable>
          <Pressable onPress={() => openMap(null)} style={[styles.card, error ? { borderColor: colors.garnet } : null]}>
            <Feather name="crosshair" size={18} color={colors.ink} />
            <Text style={styles.action}>Use my location on the map</Text>
          </Pressable>
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <SearchAddressModal
        visible={searching}
        onClose={() => setSearching(false)}
        onPicked={(c) => {
          setSearching(false);
          openMap(c);
        }}
        onPinInstead={() => {
          setSearching(false);
          openMap(value ? { latitude: value.latitude, longitude: value.longitude } : null);
        }}
      />
      <MapPickerModal
        visible={mapOpen}
        onClose={() => setMapOpen(false)}
        onConfirm={onChange}
        presetCenter={preset}
        title={mapTitle}
        confirmLabel={confirmLabel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  searchAgain: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, alignSelf: 'flex-start' },
  searchAgainText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink, textDecorationLine: 'underline' },
  actions: { gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  cardSet: { borderColor: colors.ink, borderWidth: 1.5 },
  pinTile: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  addr: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  change: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  action: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink },
  error: { fontFamily: fonts.body, fontSize: 12, color: colors.garnet },
});
