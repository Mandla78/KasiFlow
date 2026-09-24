/**
 * The onboarding steps, in order. Account creation and email verification
 * come before these and aren't counted: they're the gate, not the setup.
 */
export const STEPS = [
  { id: 'yourBusiness', route: '/your-business' },
  { id: 'registration', route: '/registration' },
  { id: 'whereYouAre', route: '/where-you-are' },
  { id: 'whatYouBuy', route: '/what-you-buy' },
] as const;

export type StepId = (typeof STEPS)[number]['id'];
