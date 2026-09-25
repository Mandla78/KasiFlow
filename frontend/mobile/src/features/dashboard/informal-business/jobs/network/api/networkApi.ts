/**
 * Which NetworkApi the app uses. Only the mock exists until the backend in
 * CONTRACT_jobs_v2.txt is approved and built; on the real API the network
 * stays hidden (NETWORK_READY), so the builder's Jobs screen is as before.
 */
import { USE_MOCK_AUTH } from '@/constants/config';

import { mockNetworkApi, practice } from './mockNetworkApi';

export const networkApi = mockNetworkApi;

/** The Builders / Suppliers tabs, partners and help posts show only where networkApi works. */
export const NETWORK_READY = USE_MOCK_AUTH;

/**
 * On the mock: sample builders answer your help posts, and "Test: answer as
 * Thabo" plays the other builder (accept, confirm a payment, pay you).
 */
export const SAMPLE_ANSWERS = USE_MOCK_AUTH;
export const practiceApi = USE_MOCK_AUTH ? practice : null;
