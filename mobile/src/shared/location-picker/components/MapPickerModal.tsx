import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MAPBOX_PUBLIC_TOKEN } from '@/constants/config';
import { Button } from '@/shared/components/Button';
import { TextField } from '@/shared/components/TextField';
import { colors, fonts, radius } from '@/shared/theme/tokens';

import { useReverseGeocode } from '../hooks';
import type { LatLng, PickedPlace } from '../types';
import { PinMap } from './PinMap';

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (place: PickedPlace) => void;
  /** Start here (a search result or the current value). Omit to use the phone's location. */
  presetCenter?: LatLng | null;
  title: string;
  confirmLabel: string;
};

// Fallback when there's no preset and location is denied or slow: Gauteng,
// zoomed out enough to navigate from.
const FALLBACK: LatLng = { latitude: -26.05, longitude: 28.1 };
const LOCATION_TIMEOUT_MS = 8000;

const EMPTY = { building: '', street: '', suburb: '', city: '', province: '', postalCode: '' };
type Fields = typeof EMPTY;

async function deviceLocation(): Promise<LatLng | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  const fix = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), LOCATION_TIMEOUT_MS)),
  ]);
  return fix ? { latitude: fix.coords.latitude, longitude: fix.coords.longitude } : null;
}

/**
 * Full-screen map with a fixed centre pin, plus the address fields.
 *
 * The confirmed coordinates are where the MAP settled (the user's own
 * action), never the reverse-geocode result; reverse geocoding only
 * pre-fills the text, which the user can edit. Once they edit a field by
 * hand, moving the map no longer overwrites their text.
 *
 * The map isn't mounted until the start point is known, because the start
 * is baked into the page; re-centring later would flash a reload.
 */
export function MapPickerModal({ visible, onClose, onConfirm, presetCenter, title, confirmLabel }: Props) {
  const [start, setStart] = useState<LatLng | null>(null);
  const [fromFallback, setFromFallback] = useState(false);
  const [center, setCenter] = useState<LatLng | null>(null);
  // null until the user types: until then the fields show the address guess.
  const [manual, setManual] = useState<Fields | null>(null);
  const [error, setError] = useState('');

  const { address, loading, failed } = useReverseGeocode(center?.latitude ?? null, center?.longitude ?? null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      if (presetCenter) {
        setStart(presetCenter);
        setFromFallback(false);
        return;
      }
      const here = await deviceLocation().catch(() => null);
      if (cancelled) return;
      setStart(here ?? FALLBACK);
      setFromFallback(!here);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, presetCenter]);

  // Once the user edits any field, moving the map no longer overwrites their text.
  const fields: Fields =
    manual ??
    (address
      ? {
          building: '',
          street: address.street ?? '',
          suburb: address.suburb ?? '',
          city: address.city ?? '',
          province: address.province ?? '',
          postalCode: address.postalCode ?? '',
        }
      : EMPTY);

  const onCenter = useCallback((c: LatLng) => setCenter(c), []);

  function close() {
    setStart(null);
    setCenter(null);
    setManual(null);
    setError('');
    onClose();
  }

  function confirm() {
    if (!center) return setError('Move the map so the pin sits on your spot.');
    if (!fields.street.trim() && !fields.suburb.trim()) return setError('Add at least a street or an area.');
    onConfirm({ ...fields, latitude: center.latitude, longitude: center.longitude });
    close();
  }

  const set = (k: keyof Fields) => (v: string) => {
    setError('');
    setManual({ ...fields, [k]: v });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={close} hitSlop={10} accessibilityLabel="Close" style={styles.close}>
            <Feather name="x" size={20} color={colors.ink} />
          </Pressable>
          <Text style={styles.title}>{title}</Text>
        </View>

        <View style={styles.mapWrap}>
          {start ? (
            <PinMap start={start} zoom={fromFallback ? 9 : 16} onCenter={onCenter} />
          ) : (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.ink} />
              <Text style={styles.hint}>Finding your location…</Text>
            </View>
          )}
        </View>
        <Text style={styles.hint}>
          {fromFallback ? "Couldn't use your location. Move the map to your spot." : 'Move the map until the pin sits exactly on your spot.'}
          {!MAPBOX_PUBLIC_TOKEN ? ' (Development map)' : ''}
        </Text>

        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <TextField label="Building, stand or house number" value={fields.building} onChangeText={set('building')} placeholder="e.g. Stand 1234" />
          <TextField label="Street" value={fields.street} onChangeText={set('street')} />
          <TextField label="Area / township" value={fields.suburb} onChangeText={set('suburb')} />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <TextField label="City" value={fields.city} onChangeText={set('city')} />
            </View>
            <View style={{ width: 110 }}>
              <TextField label="Postal code" value={fields.postalCode} onChangeText={set('postalCode')} keyboardType="number-pad" />
            </View>
          </View>
          <TextField label="Province" value={fields.province} onChangeText={set('province')} />
          {loading ? <Text style={styles.hint}>Looking up this address…</Text> : null}
          {failed && !loading ? <Text style={styles.hint}>Couldn&apos;t look this up. Type the address yourself.</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title={confirmLabel} onPress={confirm} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.porcelain },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
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
  mapWrap: { height: 300, backgroundColor: colors.iconTile },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  hint: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, textAlign: 'center', paddingVertical: 8, paddingHorizontal: 16 },
  form: { padding: 20, gap: 14, paddingBottom: 32 },
  row: { flexDirection: 'row', gap: 10 },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.garnet },
});
