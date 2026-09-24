import { Redirect } from 'expo-router';

import { useSession } from '@/features/auth/session/SessionProvider';

/**
 * Google sign-ups still need a business name (and consent, if they came
 * from Sign in rather than Create account). Email sign-ups gave both in
 * the Account stage.
 */
export default function OnboardingStartScreen() {
  const { profile } = useSession();
  const needsName = !profile.businessName || !profile.consent;
  return <Redirect href={needsName ? '/name-business' : '/your-business'} />;
}
