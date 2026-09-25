/** Which OrdersApi the app uses. Mock until the backend orders API exists (docs/supplier/09). */
import type { OrdersApi } from '../types';
import { mockOrdersApi } from './mockOrdersApi';

export const ordersApi: OrdersApi = mockOrdersApi;
