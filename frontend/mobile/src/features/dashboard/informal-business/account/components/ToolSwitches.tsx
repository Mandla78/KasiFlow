import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import type { ToolKey } from '@/constants/businessTypes';
import { USE_MOCK_AUTH } from '@/constants/config';
import { useSession } from '@/features/auth/session/SessionProvider';
import { businessProfileApi, fromServer } from '@/features/onboarding/api/businessProfileApi';
import { saveErrorMessage, savedToast } from '@/features/onboarding/sync/useSectionSave';
import { ToggleRow } from '@/shared/components/Parts';
import { colors, fonts } from '@/shared/theme/tokens';

const TOOLS: { key: ToolKey; icon: 'book' | 'package' | 'tool' | 'clipboard' | 'shield'; title: string; subtitle: string }[] = [
  { key: 'creditBook', icon: 'book', title: 'Credit book', subtitle: 'Who owes you, and when they pay' },
  { key: 'orderStock', icon: 'package', title: 'Order stock', subtitle: 'Buy from suppliers who deliver to you' },
  { key: 'jobs', icon: 'tool', title: 'Jobs', subtitle: 'Stages, photos and the client’s sign-off' },
  { key: 'orderBook', icon: 'clipboard', title: 'Order book', subtitle: 'Counter orders fast: the queue and today’s money' },
  // Not "proof": what a trader records in the tools is theirs, not verified.
  { key: 'myRecord', icon: 'shield', title: 'My record', subtitle: 'Always on: your trading history in one place' },
];

const TITLES = Object.fromEntries(TOOLS.map((t) => [t.key, t.title])) as Record<ToolKey, string>;

/**
 * A switch per tool. Each switch is saved to the server AT ONCE (not with
 * the quiet background save), so Home, Account and the tabs follow the
 * server's answer; if the server doesn't take it, the switch goes back
 * and says why. My record can't be switched off; the daily tally is coming.
 */
export function ToolSwitches() {
  const { profile, setTool, updateProfile } = useSession();
  const [saving, setSaving] = useState<ToolKey | null>(null);
  const [error, setError] = useState('');

  async function toggle(key: ToolKey, on: boolean) {
    if (key === 'myRecord' || saving) return;
    setError('');
    setTool(key, on); // shown at once; undone below if the server says no
    if (USE_MOCK_AUTH) return;
    setSaving(key);
    try {
      const saved = await businessProfileApi.save({ tools: { ...profile.tools, [key]: on } });
      updateProfile(fromServer(saved));
      savedToast(`${TITLES[key]} ${on ? 'on' : 'off'}`);
    } catch (e) {
      setTool(key, !on);
      setError(`Couldn't switch ${on ? 'on' : 'off'} ${TITLES[key]}. ${saveErrorMessage(e)}`);
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      {TOOLS.map((t) => (
        <ToggleRow
          key={t.key}
          icon={t.icon}
          title={t.title}
          subtitle={saving === t.key ? 'Saving…' : t.subtitle}
          value={t.key === 'myRecord' ? true : Boolean(profile.tools[t.key])}
          locked={t.key === 'myRecord'}
          onChange={(on) => toggle(t.key, on)}
        />
      ))}
      <ToggleRow icon="bar-chart-2" title="Daily tally" subtitle="Cash in and out, day by day" soon />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.garnet },
});
