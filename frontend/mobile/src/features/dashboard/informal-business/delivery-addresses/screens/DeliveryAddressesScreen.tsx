import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import type { Place } from '@/features/auth/types';
import { useSession } from '@/features/auth/session/SessionProvider';
import { saveErrorMessage, savedToast } from '@/features/onboarding/sync/useSectionSave';
import { newIdempotencyKey } from '@/shared/api/client';
import { Button } from '@/shared/components/Button';
import { Card, IconTile, Tag } from '@/shared/components/Parts';
import { Screen } from '@/shared/components/Screen';
import { ConfirmSheet, Sheet } from '@/shared/components/Sheet';
import { Body, Overline, Title } from '@/shared/components/Text';
import { TextField } from '@/shared/components/TextField';
import { AddressPickerField, formatPlace } from '@/shared/location-picker/components/AddressPickerField';
import { colors, fonts } from '@/shared/theme/tokens';

import { deliveryAddressesApi } from '../api/deliveryAddressesApi';
import { MAX_ADDRESSES, type DeliveryAddress } from '../types';

type Editing = { address: DeliveryAddress | null } | null;

/** A saved address as the picker's value (we keep its text and pin, not its parts). */
function asPlace(a: DeliveryAddress): Place {
  return { building: '', street: a.addressText, suburb: '', city: '', province: '', postalCode: '', latitude: a.latitude, longitude: a.longitude };
}

/**
 * More -> Delivery addresses: the business address (from Business
 * profile), then up to 5 saved places -- a second shop, home, a site.
 * Checkout offers them all; the default is picked first.
 */
export default function DeliveryAddressesScreen() {
  const { profile } = useSession();
  const [items, setItems] = useState<DeliveryAddress[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [removing, setRemoving] = useState<DeliveryAddress | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    let live = true;
    setFailed(false);
    deliveryAddressesApi
      .list()
      .then((list) => live && setItems(list))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);
  useFocusEffect(load);

  async function act(run: () => Promise<unknown>, done: string) {
    setError('');
    try {
      await run();
      savedToast(done);
    } catch (e) {
      setError(saveErrorMessage(e));
    }
    load();
  }

  const full = (items?.length ?? 0) >= MAX_ADDRESSES;

  return (
    <Screen
      back
      footer={
        items ? (
          <Button
            title={full ? `You can keep ${MAX_ADDRESSES} addresses` : 'Add an address'}
            icon="plus"
            disabled={full}
            onPress={() => setEditing({ address: null })}
          />
        ) : undefined
      }>
      <View style={{ gap: 6 }}>
        <Title>Delivery addresses</Title>
        <Body>Where suppliers can deliver your stock. At checkout you choose one.</Body>
      </View>

      <Overline>Business address</Overline>
      <Card onPress={() => router.push('/informal-business/business/where-you-are')}>
        <View style={styles.row}>
          <IconTile name="home" />
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>My business</Text>
            <Text style={styles.text}>{profile.location ? formatPlace(profile.location) : 'Not set yet. Tap to add where your business is.'}</Text>
          </View>
        </View>
      </Card>

      <Overline>Saved places</Overline>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {failed ? (
        <Card onPress={load}>
          <Text style={styles.text}>Couldn&apos;t load your addresses. Tap to try again.</Text>
        </Card>
      ) : items === null ? (
        <ActivityIndicator color={colors.accent} />
      ) : items.length === 0 ? (
        <Card>
          <Text style={styles.text}>No saved places yet. Add a second shop, your home or a building site.</Text>
        </Card>
      ) : (
        items.map((a) => (
          <Card key={a.id}>
            <View style={styles.row}>
              <IconTile name="map-pin" />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.titleRow}>
                  <Text style={styles.label}>{a.label}</Text>
                  {a.isDefault ? <Tag label="Default" tone="jade" /> : null}
                </View>
                <Text style={styles.text}>{a.addressText}</Text>
              </View>
            </View>
            <View style={styles.actions}>
              {!a.isDefault ? (
                <Text style={styles.link} accessibilityRole="button" onPress={() => act(() => deliveryAddressesApi.makeDefault(a.id), 'Default address set')}>
                  Make default
                </Text>
              ) : null}
              <Text style={styles.link} accessibilityRole="button" onPress={() => setEditing({ address: a })}>
                Edit
              </Text>
              <Text style={[styles.link, { color: colors.garnet }]} accessibilityRole="button" onPress={() => setRemoving(a)}>
                Remove
              </Text>
            </View>
          </Card>
        ))
      )}

      {editing ? (
        <AddressForm
          address={editing.address}
          makeDefault={(items?.length ?? 0) === 0}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      ) : null}
      <ConfirmSheet
        visible={removing !== null}
        title={`Remove ${removing?.label ?? 'this address'}?`}
        message="Orders that already went there keep their address."
        confirmLabel="Remove"
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const a = removing;
          setRemoving(null);
          if (a) act(() => deliveryAddressesApi.remove(a.id), 'Address removed');
        }}
      />
    </Screen>
  );
}

/** Add or edit one address: a name the trader recognises, and a pin on the map. */
function AddressForm({ address, makeDefault, onClose, onSaved }: { address: DeliveryAddress | null; makeDefault: boolean; onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState(address?.label ?? '');
  const [place, setPlace] = useState<Place | null>(address ? asPlace(address) : null);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // One key for this new address: a retried save lands once.
  const key = useRef(newIdempotencyKey());

  const labelError = !label.trim() ? 'Give it a name, like "Home" or "Site on Main Rd"' : label.trim().length > 30 ? 'Up to 30 letters' : '';
  const placeError = !place ? 'Search the address or drop a pin' : '';

  async function save() {
    setTouched(true);
    if (labelError || placeError || !place) return;
    setBusy(true);
    setError('');
    const change = { label: label.trim(), addressText: formatPlace(place), latitude: place.latitude, longitude: place.longitude };
    try {
      if (address) await deliveryAddressesApi.update(address.id, change);
      else await deliveryAddressesApi.add({ ...change, isDefault: makeDefault }, key.current);
      savedToast('Address saved');
      onSaved();
    } catch (e) {
      setError(saveErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible onClose={onClose}>
      <Text style={styles.sheetTitle}>{address ? 'Edit address' : 'Add an address'}</Text>
      <TextField label="Name" placeholder="e.g. Home, Site on Main Rd" value={label} onChangeText={setLabel} error={touched ? labelError : ''} />
      <AddressPickerField label="Address" value={place} onChange={setPlace} mapTitle="Where to deliver" confirmLabel="Deliver here" error={touched ? placeError : ''} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Save address" onPress={save} loading={busy} />
      <Button title="Cancel" variant="secondary" onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  text: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  actions: { flexDirection: 'row', gap: 18, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line },
  link: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink, paddingVertical: 6 },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.garnet },
  sheetTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
});
