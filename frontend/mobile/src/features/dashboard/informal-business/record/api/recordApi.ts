/**
 * Which RecordApi the app uses: the real backend, or the mock when
 * EXPO_PUBLIC_USE_MOCK_API is not "false" (the same switch as sign-in).
 */
import { USE_MOCK_AUTH } from '@/constants/config';

import { httpRecordApi } from './httpRecordApi';
import { mockRecordApi } from './mockRecordApi';

export const recordApi = USE_MOCK_AUTH ? mockRecordApi : httpRecordApi;
