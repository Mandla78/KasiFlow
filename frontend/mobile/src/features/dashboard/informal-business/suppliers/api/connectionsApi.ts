/** Connect / disconnect: saved on the server, or (mock) only in the profile. */
import { USE_MOCK_AUTH } from '@/constants/config';

import { httpConnectionsApi, mockConnectionsApi } from './httpSupplierApis';

export const connectionsApi = USE_MOCK_AUTH ? mockConnectionsApi : httpConnectionsApi;
