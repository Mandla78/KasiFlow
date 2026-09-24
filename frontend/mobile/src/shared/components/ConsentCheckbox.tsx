import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { Checkbox } from './Choice';
import { colors, fonts } from '@/shared/theme/tokens';

/**
 * "I agree to the Privacy Policy and Terms of Use". Mandatory: the
 * sign-up buttons stay disabled until it's ticked. The versions agreed to
 * are stamped by the session (consentNow) and stored by the backend.
 */
export function ConsentCheckbox({ checked, onChange, error }: { checked: boolean; onChange: (v: boolean) => void; error?: boolean }) {
  return (
    <Checkbox checked={checked} onChange={onChange} error={error} label="I agree to the Privacy Policy and Terms of Use">
      <Text style={styles.text}>
        <Text onPress={() => onChange(!checked)}>I agree to Akayza&apos;s</Text>{' '}
        <Text style={styles.link} onPress={() => router.push('/privacy-policy')} accessibilityRole="link">
          Privacy Policy
        </Text>{' '}
        and{' '}
        <Text style={styles.link} onPress={() => router.push('/terms-of-use')} accessibilityRole="link">
          Terms of Use
        </Text>
        .
      </Text>
      {error && !checked ? <Text style={styles.error}>Tick the box to continue.</Text> : null}
    </Checkbox>
  );
}

const styles = StyleSheet.create({
  text: { fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 20, color: colors.text },
  link: { fontFamily: fonts.bold, color: colors.ink, textDecorationLine: 'underline' },
  error: { fontFamily: fonts.body, fontSize: 12, color: colors.garnet, marginTop: 4 },
});
