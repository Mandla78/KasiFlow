/**
 * Where the phone keeps the owner's record seal: a file in the app's own
 * documents folder (on the web, the browser's storage). A seal is several
 * kilobytes -- too big for secure storage -- and holds nothing secret:
 * kinds, ids, fingerprints and our signatures. One seal per account.
 */
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import type { RecordSeal } from '../types';

const name = (account: string) => `record-seal-${account.toLowerCase().replace(/[^a-z0-9]/g, '_')}.json`;

export async function loadSeal(account: string): Promise<RecordSeal | null> {
  try {
    if (Platform.OS === 'web') {
      const raw = globalThis.localStorage?.getItem(name(account));
      return raw ? (JSON.parse(raw) as RecordSeal) : null;
    }
    const file = new File(Paths.document, name(account));
    return file.exists ? (JSON.parse(await file.text()) as RecordSeal) : null;
  } catch {
    return null; // unreadable: as if never sealed
  }
}

export function saveSeal(account: string, seal: RecordSeal): void {
  const text = JSON.stringify(seal);
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(name(account), text);
    return;
  }
  const file = new File(Paths.document, name(account));
  if (!file.exists) file.create();
  file.write(text);
}
