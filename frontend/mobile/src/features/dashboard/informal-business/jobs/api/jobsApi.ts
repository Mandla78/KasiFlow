/**
 * Which JobsApi the app uses. Mock until the jobs contract is approved and
 * the backend exists; then httpJobsApi joins here behind USE_MOCK_AUTH
 * (EXPO_PUBLIC_USE_MOCK_API), like the credit book, and no screen changes.
 */
import { mockJobsApi } from './mockJobsApi';

export const jobsApi = mockJobsApi;
