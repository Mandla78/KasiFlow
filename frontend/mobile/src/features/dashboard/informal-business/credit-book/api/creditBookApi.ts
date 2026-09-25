/**
 * Which CreditBookApi the app uses. Mock until the contract is approved and
 * the backend exists; then httpCreditBookApi joins here behind
 * USE_MOCK_AUTH (EXPO_PUBLIC_USE_MOCK_API) and no screen changes.
 */
import { mockCreditBookApi } from './mockCreditBookApi';

export const creditBookApi = mockCreditBookApi;
