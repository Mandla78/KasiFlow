/**
 * Which NetworkApi the app uses: the real backend (CONTRACT_jobs_v2.txt),
 * or the mock when EXPO_PUBLIC_USE_MOCK_API is not "false" (the same
 * switch as sign-in).
 */
import { USE_MOCK_AUTH } from '@/constants/config';

import { httpNetworkApi } from './httpNetworkApi';
import { mockNetworkApi, practice } from './mockNetworkApi';

export const networkApi = USE_MOCK_AUTH ? mockNetworkApi : httpNetworkApi;

/** The Builders / Suppliers tabs, partners and help posts: on, now the backend exists. */
export const NETWORK_READY = true;

/**
 * On the mock: sample builders answer your help posts, and "Test: answer as
 * Thabo" plays the other builder (accept, confirm a payment, pay you). On
 * the real API the other builder answers on their own phone
 * (`flask builders seed` makes sample builders to try it with).
 */
export const SAMPLE_ANSWERS = USE_MOCK_AUTH;
export const practiceApi = USE_MOCK_AUTH ? practice : null;
