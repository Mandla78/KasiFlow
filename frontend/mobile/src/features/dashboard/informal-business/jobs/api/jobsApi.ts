/**
 * Which JobsApi the app uses. Mock until the jobs contract is approved and
 * the backend exists; then httpJobsApi joins here behind USE_MOCK_AUTH
 * (EXPO_PUBLIC_USE_MOCK_API), like the credit book, and no screen changes.
 */
import { mockJobsApi } from './mockJobsApi';

export const jobsApi = mockJobsApi;

/**
 * The in-app practice sign-off (playing the client) exists only while jobs
 * run on the mock; with the backend, the client uses the real web page.
 */
export const PRACTICE_SIGN_OFF = true;
