import { useCallback, useState } from 'react';

import { useSession } from '@/features/auth/session/SessionProvider';
import { ConfirmSheet } from '@/shared/components/Sheet';

import { clearCart } from '../../cart/lib/cartStore';
import { connectionsApi } from '../api/connectionsApi';

type Pending = { id: string; name: string; connect: boolean; then?: () => void };

/**
 * Connecting with a supplier is what lets you order from them. Connect and
 * disconnect both ask first. Render `sheet` once on the screen.
 */
export function useConnect() {
  const { profile, updateProfile } = useSession();
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isConnected = (id: string) => profile.supplierIds.includes(id);

  /** Ask to connect (or disconnect, if already connected); `then` runs after a Yes to connect. */
  const ask = (id: string, name: string, then?: () => void) => setPending({ id, name, connect: !isConnected(id), then });

  /** The server first (when there is one); the phone's copy only once it said yes. */
  async function confirm() {
    if (!pending || busy) return;
    setBusy(true);
    setError('');
    try {
      if (pending.connect) {
        await connectionsApi.connect(pending.id);
        updateProfile({ supplierIds: [...new Set([...profile.supplierIds, pending.id])] });
        pending.then?.();
      } else {
        await connectionsApi.disconnect(pending.id);
        updateProfile({ supplierIds: profile.supplierIds.filter((x) => x !== pending.id) });
        clearCart(pending.id);
      }
      setPending(null);
    } catch {
      setError("Couldn't save that. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  /** The server's list wins (another phone may have changed it). */
  const syncFromServer = useCallback(
    (connectedIds: string[]) => {
      const same = connectedIds.length === profile.supplierIds.length && connectedIds.every((id) => profile.supplierIds.includes(id));
      if (!same) updateProfile({ supplierIds: connectedIds });
    },
    [profile.supplierIds, updateProfile],
  );

  const sheet = (
    <ConfirmSheet
      visible={!!pending}
      title={pending?.connect ? `Connect with ${pending.name}?` : `Disconnect from ${pending?.name ?? ''}?`}
      message={
        error ||
        (pending?.connect
          ? "Once you're connected, you can start ordering from them."
          : "You won't be able to order from them until you connect again. Anything in your cart with them is removed. Your past orders stay in My orders.")
      }
      confirmLabel={pending?.connect ? 'Yes, connect' : 'Yes, disconnect'}
      danger={!pending?.connect}
      onConfirm={confirm}
      onCancel={() => {
        setPending(null);
        setError('');
      }}
    />
  );

  return { isConnected, ask, sheet, syncFromServer };
}
