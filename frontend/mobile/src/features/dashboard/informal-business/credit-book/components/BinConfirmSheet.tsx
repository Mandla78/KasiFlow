/**
 * "Move to the bin?" -- says plainly what deleting does and doesn't do:
 * the item leaves the trader's lists and totals, can be restored for 30
 * days, and anything confirmed or paid stays in their record; `warns` says
 * what stops (a job's open sign-off links). Used by the credit book and
 * jobs. Mount it only while open.
 */
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { ApiError } from '@/shared/api/client';
import { Button } from '@/shared/components/Button';
import { InfoNote } from '@/shared/components/Parts';
import { colors, fonts } from '@/shared/theme/tokens';

import { Sheet } from './Sheet';

type Props = {
  title: string;
  /** What stays behind, e.g. "The R20 paid back stays in your record." */
  keeps?: string;
  /** What stops working, e.g. a sign-off link the client hasn't answered. */
  warns?: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export function BinConfirmSheet({ title, keeps, warns, onClose, onConfirm }: Props) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setFailure('');
    try {
      await onConfirm();
    } catch (e) {
      setFailure(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
      setBusy(false);
    }
  }

  return (
    <Sheet visible onClose={onClose} title={title}>
      <Text style={styles.body}>It leaves your lists and totals. You can restore it from the bin for 30 days.</Text>
      {keeps ? <InfoNote icon="shield">{keeps}</InfoNote> : null}
      {warns ? <InfoNote icon="link-2">{warns}</InfoNote> : null}
      {failure ? <Text style={styles.failure}>{failure}</Text> : null}
      <Button title="Move to the bin" icon="trash-2" variant="danger" onPress={confirm} loading={busy} />
      <Button title="Keep it" variant="secondary" onPress={onClose} disabled={busy} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  failure: { fontFamily: fonts.medium, fontSize: 13, color: colors.garnet },
});
