/**
 * location-picker -- search an address or drop a pin, then confirm the
 * address text. Adapted from TruConnect (see REUSE.md). Used by
 * onboarding now, and by orders (delivery address) later.
 */

/** The backend's reverse-geocode guess. Any field can be null: a
 *  township or rural pin may have partial or no coverage. */
export interface GeocodedAddress {
  street: string | null;
  suburb: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
}

/** One typeahead result. `id` is opaque: only ever passed back to
 *  retrieveAddress, never shown or stored. */
export interface AddressSuggestion {
  id: string;
  name: string;
  fullAddress: string | null;
}

export type LatLng = { latitude: number; longitude: number };

/** What the user confirms: their own (editable) text plus the pin they set
 *  on the map. Stored as the user's data; never a stored Mapbox result. */
export type PickedPlace = {
  building: string;
  street: string;
  suburb: string;
  city: string;
  province: string;
  postalCode: string;
  latitude: number;
  longitude: number;
};
