/**
 * Which JobsApi the app uses: the real backend, or the mock when
 * EXPO_PUBLIC_USE_MOCK_API is not "false" (the same switch as sign-in).
 */
import { USE_MOCK_AUTH } from '@/constants/config';

import { httpJobsApi } from './httpJobsApi';
import { mockJobsApi } from './mockJobsApi';

export const jobsApi = USE_MOCK_AUTH ? mockJobsApi : httpJobsApi;

/**
 * The in-app practice sign-off (playing the client) only exists on the
 * mock; with the backend, the client uses the real page from the link.
 */
export const PRACTICE_SIGN_OFF = USE_MOCK_AUTH;

/** The bin: on the mock and the backend alike (CONTRACT_bin.txt). */
export const BIN_READY = true;
