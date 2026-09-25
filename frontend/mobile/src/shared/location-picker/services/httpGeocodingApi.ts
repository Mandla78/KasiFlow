/**
 * The REAL address search: our backend's /geocoding endpoints, which call
 * Mapbox with the token the app never sees.
 */
import { api } from '@/shared/api/client';

import type { AddressSuggestion, GeocodedAddress, LatLng } from '../types';
import type { GeocodingApi } from './geocodingApi';

function query(params: Record<string, string | number | undefined>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

type ServerSuggestion = { id: string; name: string; full_address: string };
type ServerAddress = { street: string | null; suburb: string | null; city: string | null; province: string | null; postal_code: string | null };

export const httpGeocodingApi: GeocodingApi = {
  async suggest(q, sessionToken, proximity) {
    const trimmed = q.trim();
    if (trimmed.length < 2) return [];
    const path = `/geocoding/suggest?${query({ q: trimmed, session: sessionToken, lat: proximity?.latitude, lng: proximity?.longitude })}`;
    const { suggestions } = await api<{ suggestions: ServerSuggestion[] }>('GET', path, undefined, { auth: true });
    return suggestions.map((s): AddressSuggestion => ({ id: s.id, name: s.name, fullAddress: s.full_address || null }));
  },

  async retrieve(id, sessionToken): Promise<LatLng> {
    return api<LatLng>('GET', `/geocoding/retrieve?${query({ id, session: sessionToken })}`, undefined, { auth: true });
  },

  async reverse(latitude, longitude): Promise<GeocodedAddress> {
    const { address: a } = await api<{ address: ServerAddress }>('GET', `/geocoding/reverse?${query({ lat: latitude, lng: longitude })}`, undefined, {
      auth: true,
    });
    return { street: a.street, suburb: a.suburb, city: a.city, province: a.province, postalCode: a.postal_code };
  },
};
