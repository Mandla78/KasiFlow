/** Which SupplierMatchApi the app uses: the server's recommendation engine, or the mock. */
import { USE_MOCK_AUTH } from '@/constants/config';

import { httpSupplierMatchApi } from './httpSupplierApis';
import { mockSupplierMatchApi } from './mockSupplierMatchApi';

export const supplierMatchApi = USE_MOCK_AUTH ? mockSupplierMatchApi : httpSupplierMatchApi;
