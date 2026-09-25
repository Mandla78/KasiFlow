import { useState } from 'react';

import { useSession } from '@/features/auth/session/SessionProvider';
import { ConfirmSheet } from '@/shared/components/Sheet';

import { clearCart } from '../../cart/lib/cartStore';

type Pending = { id: string; name: string; connect: boolean; then?: () => void };

/**
 * Connecting with a supplier is what lets you order from them. Connect and
 * disconnect both ask first. Render `sheet` once on the screen.
 */
export function useConnect() {
  const { profile, updateProfile } = useSession();
  const [pending, setPending] = useState<Pending | null>(null);

  const isConnected = (id: string) => profile.supplierIds.includes(id);

  /** Ask to connect (or disconnect, if already connected); `then` runs after a Yes to connect. */
  const ask = (id: string, name: string, then?: () => void) => setPending({ id, name, connect: !isConnected(id), then });

  function confirm() {
    if (!pending) return;
    if (pending.connect) {
      updateProfile({ supplierIds: [...profile.supplierIds, pending.id] });
      pending.then?.();
    } else {
      updateProfile({ supplierIds: profile.supplierIds.filter((x) => x !== pending.id) });
      clearCart(pending.id);
    }
    setPending(null);
  }

  const sheet = (
    <ConfirmSheet
      visible={!!pending}
      title={pending?.connect ? `Connect with ${pending.name}?` : `Disconnect from ${pending?.name ?? ''}?`}
      message={
        pending?.connect
          ? "Once you're connected, you can start ordering from them."
          : "You won't be able to order from them until you connect again. Anything in your cart with them is removed. Your past orders stay in My orders."
      }
      confirmLabel={pending?.connect ? 'Yes, connect' : 'Yes, disconnect'}
      danger={!pending?.connect}
      onConfirm={confirm}
      onCancel={() => setPending(null)}
    />
  );

  return { isConnected, ask, sheet };
}
