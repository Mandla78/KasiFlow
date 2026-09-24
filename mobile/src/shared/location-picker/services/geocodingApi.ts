/**
 * Address search and lookup. The real implementation calls OUR backend,
 * which calls Mapbox with the secret token: the app never holds it.
 * Mock until the backend geocoding endpoints exist.
 */
import type { AddressSuggestion, GeocodedAddress, LatLng } from '../types';
import { mockGeocodingApi } from './mockGeocodingApi';

export interface GeocodingApi {
  /** Typeahead. One sessionToken per search, as Mapbox bills per session. */
  suggest(query: string, sessionToken: string, proximity?: LatLng): Promise<AddressSuggestion[]>;
  /** Coordinates for a tapped suggestion. Used only to CENTRE the map. */
  retrieve(id: string, sessionToken: string): Promise<LatLng>;
  /** Pre-fills the editable address fields for a pin. Never stored as-is. */
  reverse(latitude: number, longitude: number): Promise<GeocodedAddress>;
}

export const geocodingApi: GeocodingApi = mockGeocodingApi;
