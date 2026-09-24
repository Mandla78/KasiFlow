/**
 * Two-factor sign-in, the phone's half. After this phone passes an email
 * code, the server gives it a "trusted phone" token; sending it with the
 * password skips the code next time. Kept in secure storage, one per
 * account (a shared phone can hold several), and NOT cleared on sign-out:
 * signing out isn't a reason to distrust your own phone. The server can
 * still revoke it ("sign out other phones", closing the account).
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'akayza.trusted-phone.v1';
let memory: Record<string, string> | null = null;

async function all(): Promise<Record<string, string>> {
  if (memory) return memory;
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    memory = raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    memory = {}; // web preview: memory only
  }
  return memory;
}

export async function getTrustedToken(email: string): Promise<string | undefined> {
  return (await all())[email.trim().toLowerCase()];
}

export async function setTrustedToken(email: string, token: string | undefined): Promise<void> {
  if (!token) return;
  const map = { ...(await all()), [email.trim().toLowerCase()]: token };
  memory = map;
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(map));
  } catch {
    // no secure storage (web preview)
  }
}

/** How this phone names itself on the Security screen. Not a secret. */
export function phoneInfo(): { platform: 'android' | 'ios' | 'web'; label: string } {
  if (Platform.OS === 'android') {
    const c = Platform.constants as { Brand?: string; Model?: string };
    const brand = c.Brand ? c.Brand.charAt(0).toUpperCase() + c.Brand.slice(1) : '';
    const label = [brand, c.Model].filter(Boolean).join(' ') || 'Android phone';
    return { platform: 'android', label: label.slice(0, 80) };
  }
  if (Platform.OS === 'ios') return { platform: 'ios', label: 'iPhone' };
  return { platform: 'web', label: 'Web browser' };
}
