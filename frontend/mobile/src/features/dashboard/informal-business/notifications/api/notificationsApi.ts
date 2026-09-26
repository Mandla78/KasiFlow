/**
 * Which NotificationsApi the app uses: the real backend, or the mock when
 * EXPO_PUBLIC_USE_MOCK_API is not "false" (the same switch as sign-in).
 */
import { USE_MOCK_AUTH } from '@/constants/config';

import { httpNotificationsApi } from './httpNotificationsApi';
import { mockNotificationsApi } from './mockNotificationsApi';

export const notificationsApi = USE_MOCK_AUTH ? mockNotificationsApi : httpNotificationsApi;
