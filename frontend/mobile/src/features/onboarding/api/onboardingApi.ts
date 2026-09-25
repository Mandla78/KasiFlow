/** Which OnboardingApi the app uses: EXPO_PUBLIC_USE_MOCK_API=false -> the real backend. */
import { USE_MOCK_AUTH } from '@/constants/config';

import { httpOnboardingApi } from './httpOnboardingApi';
import { mockOnboardingApi } from './mockOnboardingApi';

export const onboardingApi = USE_MOCK_AUTH ? mockOnboardingApi : httpOnboardingApi;
