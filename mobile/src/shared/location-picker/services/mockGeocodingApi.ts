import type { AddressSuggestion, GeocodedAddress, LatLng } from '../types';
import type { GeocodingApi } from './geocodingApi';

const latency = (ms = 350) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// A few real places around Tembisa / Ekurhuleni, so search -> map ->
// suppliers-near-you can be exercised end to end without a token.
const PLACES: (AddressSuggestion & LatLng & { address: GeocodedAddress })[] = [
  {
    id: 'mock-tembisa-1',
    name: 'Andrew Mapheto Drive',
    fullAddress: 'Andrew Mapheto Drive, Tembisa, Ekurhuleni, Gauteng',
    latitude: -25.9964,
    longitude: 28.2268,
    address: { street: 'Andrew Mapheto Drive', suburb: 'Tembisa', city: 'Ekurhuleni', province: 'Gauteng', postalCode: '1632' },
  },
  {
    id: 'mock-tembisa-2',
    name: 'Tembisa Plaza',
    fullAddress: 'Tembisa Plaza, Isekelo, Tembisa, Gauteng',
    latitude: -25.9939,
    longitude: 28.2244,
    address: { street: 'Flint Mazibuko Drive', suburb: 'Isekelo', city: 'Ekurhuleni', province: 'Gauteng', postalCode: '1632' },
  },
  {
    id: 'mock-ivory-park',
    name: 'Ivory Park',
    fullAddress: 'Ivory Park, Midrand, Gauteng',
    latitude: -25.9936,
    longitude: 28.1826,
    address: { street: null, suburb: 'Ivory Park', city: 'Johannesburg', province: 'Gauteng', postalCode: '1693' },
  },
  {
    id: 'mock-soweto',
    name: 'Vilakazi Street',
    fullAddress: 'Vilakazi Street, Orlando West, Soweto, Gauteng',
    latitude: -26.2386,
    longitude: 27.9086,
    address: { street: 'Vilakazi Street', suburb: 'Orlando West', city: 'Johannesburg', province: 'Gauteng', postalCode: '1804' },
  },
];

/**
 * A stable spot for typed text: near Soweto if it mentions Soweto,
 * otherwise inside Tembisa. The same text always lands on the same spot.
 */
// Where each typed address was placed, so the map pre-fills what was typed.
const typedSpots: { text: string; at: LatLng }[] = [];

function placeForText(text: string): LatLng {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  const dx = ((h & 0xff) / 255 - 0.5) * 0.02; // about +-1 km
  const dy = (((h >> 8) & 0xff) / 255 - 0.5) * 0.02;
  const base = /soweto/i.test(text) ? PLACES[3] : PLACES[0];
  const at = { latitude: base.latitude + dy, longitude: base.longitude + dx };
  typedSpots.push({ text, at });
  return at;
}

function nearest(latitude: number, longitude: number) {
  return PLACES.reduce((best, p) =>
    Math.hypot(p.latitude - latitude, p.longitude - longitude) < Math.hypot(best.latitude - latitude, best.longitude - longitude) ? p : best,
  );
}

export const mockGeocodingApi: GeocodingApi = {
  async suggest(query) {
    await latency(250);
    const q = query.trim();
    if (!q) return [];
    // Whatever was typed always comes first, so any real address can be
    // tested without a Mapbox token. The known places follow.
    const typed: AddressSuggestion = { id: `typed:${q}`, name: q, fullAddress: `${q} (as typed) · Gauteng` };
    const known = PLACES.filter((p) => `${p.name} ${p.fullAddress}`.toLowerCase().includes(q.toLowerCase())).map(
      ({ id, name, fullAddress }) => ({ id, name, fullAddress }),
    );
    return [typed, ...known];
  },

  async retrieve(id) {
    await latency(250);
    if (id.startsWith('typed:')) return placeForText(id.slice('typed:'.length));
    const p = PLACES.find((x) => x.id === id) ?? PLACES[0];
    return { latitude: p.latitude, longitude: p.longitude };
  },

  async reverse(latitude, longitude) {
    await latency();
    const area = nearest(latitude, longitude).address;
    // Pin still (almost) where a typed address was placed: use that text as the street.
    const typed = typedSpots.find((s) => Math.hypot(s.at.latitude - latitude, s.at.longitude - longitude) < 0.0005);
    return typed ? { ...area, street: typed.text } : area;
  },
};
