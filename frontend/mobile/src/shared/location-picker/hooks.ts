import { useEffect, useRef, useState } from 'react';

import { geocodingApi } from './services/geocodingApi';
import type { AddressSuggestion, GeocodedAddress } from './types';

const DEBOUNCE_MS = 300;

/** A random id for one search session (Mapbox bills search per session). */
export function newSessionToken(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Debounced typeahead; stale answers are dropped. */
export function useAddressSearch() {
  const [query, setQueryState] = useState('');
  const [results, setResults] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const session = useRef(newSessionToken());
  const requestId = useRef(0);
  const active = query.trim().length > 0;

  const setQuery = (q: string) => {
    // Typing from empty starts a new billing session.
    if (!query.trim() && q.trim()) session.current = newSessionToken();
    setQueryState(q);
  };

  useEffect(() => {
    if (!active) return;
    const id = ++requestId.current;
    const timer = setTimeout(() => {
      setLoading(true);
      geocodingApi
        .suggest(query, session.current)
        .then((r) => id === requestId.current && setResults(r))
        .catch(() => id === requestId.current && setResults([]))
        .finally(() => id === requestId.current && setLoading(false));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, active]);

  return { query, setQuery, suggestions: active ? results : [], loading: active && loading, sessionToken: session };
}

/** Address guess for the pin, debounced while the map is moving. */
export function useReverseGeocode(latitude: number | null, longitude: number | null) {
  const [address, setAddress] = useState<GeocodedAddress | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    if (latitude === null || longitude === null) return;
    const id = ++requestId.current;
    const timer = setTimeout(() => {
      setLoading(true);
      setFailed(false);
      geocodingApi
        .reverse(latitude, longitude)
        .then((a) => id === requestId.current && setAddress(a))
        .catch(() => id === requestId.current && setFailed(true))
        .finally(() => id === requestId.current && setLoading(false));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [latitude, longitude]);

  return { address, loading, failed };
}
