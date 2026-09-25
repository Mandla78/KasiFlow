/**
 * Which NetworkApi the app uses. Only the mock exists until the backend in
 * CONTRACT_jobs_v2.txt is approved and built; on the real API the network
 * stays hidden (NETWORK_READY), so the builder's Jobs screen is as before.
 */
import { USE_MOCK_AUTH } from '@/constants/config';

import { mockNetworkApi } from './mockNetworkApi';

export const networkApi = mockNetworkApi;

/** The For you / Suppliers tabs and help posts show only where networkApi works. */
export const NETWORK_READY = USE_MOCK_AUTH;

/** On the mock, sample builders answer your help post a few seconds after you post (marked "Test"). */
export const SAMPLE_ANSWERS = USE_MOCK_AUTH;
