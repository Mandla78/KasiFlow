/**
 * App-wide settings read from EXPO_PUBLIC_* environment variables
 * (frontend/mobile/.env, git-ignored). Only PUBLIC values belong here: anything in
 * the app bundle can be read by anyone who installs it.
 */

/** Slogan under the logo on the landing screen. */
export const SLOGAN = 'Keep it in the kasi.';

/**
 * Mapbox PUBLIC token (pk.*), read-only by design and safe in the app.
 * The secret token for search lives on the backend only. When this is
 * empty the map falls back to OpenStreetMap tiles so development still
 * works; production must set it.
 */
export const MAPBOX_PUBLIC_TOKEN: string = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';

/** Where the backend lives (on a phone: your PC's IP, not localhost). */
export const API_BASE_URL: string = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';

/**
 * The real backend (false) or the mocks (true, the default), for sign-in,
 * onboarding, the tools and the supplier screens. Orders are still mocked
 * (they price from whichever catalogue is active).
 */
export const USE_MOCK_AUTH: boolean = process.env.EXPO_PUBLIC_USE_MOCK_API !== 'false';

/** Google sign-in in the app needs a native module + client IDs (next build). */
export const GOOGLE_READY = false;
