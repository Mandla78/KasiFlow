import { Redirect } from 'expo-router';

import { useSession } from '@/features/auth/session/SessionProvider';

/**
 * Where onboarding (re)starts. Google sign-ups first need consent (if they
 * came from Sign in) and a name. Everyone else resumes at the
 * first step not done yet -- someone who left half-way (or signed in on
 * another phone) doesn't start again from step 1. The registration step is
 * optional, so it's never where a resume lands.
 */
export default function OnboardingStartScreen() {
  const { profile: p } = useSession();
  if (!p.consent) return <Redirect href="/name-business" />;
  const businessDone = !!p.businessName && !!p.businessType && (p.businessType !== 'builder' || !!p.trade) && !!p.ownerName && !!p.yearsTrading;
  if (!businessDone) return <Redirect href="/your-business" />;
  if (!p.location) return <Redirect href="/where-you-are" />;
  return <Redirect href="/what-you-buy" />;
}
