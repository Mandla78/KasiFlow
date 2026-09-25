/** Which OrdersApi the app uses: the server (EXPO_PUBLIC_USE_MOCK_API=false) or the mock. */
import { USE_MOCK_AUTH } from '@/constants/config';

import type { OrdersApi } from '../types';
import { httpOrdersApi } from './httpOrdersApi';
import { mockOrdersApi } from './mockOrdersApi';

export const ordersApi: OrdersApi = USE_MOCK_AUTH ? mockOrdersApi : httpOrdersApi;
