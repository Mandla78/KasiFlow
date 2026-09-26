/** Which DeliveryAddressesApi the app uses: the server (EXPO_PUBLIC_USE_MOCK_API=false) or the mock. */
import { USE_MOCK_AUTH } from '@/constants/config';

import type { DeliveryAddressesApi } from '../types';
import { httpDeliveryAddressesApi } from './httpDeliveryAddressesApi';
import { mockDeliveryAddressesApi } from './mockDeliveryAddressesApi';

export const deliveryAddressesApi: DeliveryAddressesApi = USE_MOCK_AUTH ? mockDeliveryAddressesApi : httpDeliveryAddressesApi;
