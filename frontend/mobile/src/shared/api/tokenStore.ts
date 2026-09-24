/**
 * Where the sign-in tokens live: the phone's secure storage (Android
 * Keystore / iOS Keychain), with an in-memory copy for speed. On the web
 * preview secure storage doesn't exist, so tokens live in memory only and
 * a page refresh signs you out (that's fine for a preview).
 */
import * as SecureStore from 'expo-secure-store';

export type Tokens = { accessToken: string; refreshToken: string };

const KEY = 'akayza.tokens.v1';
let memory: Tokens | null = null;
let loaded = false;

export async function getTokens(): Promise<Tokens | null> {
  if (loaded) return memory;
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    memory = raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    memory = null;
  }
  loaded = true;
  return memory;
}

export async function setTokens(tokens: Tokens): Promise<void> {
  memory = tokens;
  loaded = true;
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(tokens));
  } catch {
    // No secure storage (web preview): memory only.
  }
}

export async function clearTokens(): Promise<void> {
  memory = null;
  loaded = true;
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // nothing stored
  }
}
