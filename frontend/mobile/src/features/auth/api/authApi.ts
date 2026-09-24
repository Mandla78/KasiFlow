/**
 * The one place that decides which AuthApi the app uses. Swap to
 * httpAuthApi when the backend identity endpoints are ready.
 */
import { mockAuthApi } from './mockAuthApi';

export * from '../types';
export const authApi = mockAuthApi;
