/**
 * The one place that decides which AuthApi the app uses:
 * EXPO_PUBLIC_USE_MOCK_API=false in frontend/mobile/.env -> the real backend.
 */
import { USE_MOCK_AUTH } from '@/constants/config';

import { httpAuthApi } from './httpAuthApi';
import { mockAuthApi } from './mockAuthApi';

export * from '../types';
export const authApi = USE_MOCK_AUTH ? mockAuthApi : httpAuthApi;
