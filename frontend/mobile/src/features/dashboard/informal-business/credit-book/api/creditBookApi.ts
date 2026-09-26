/**
 * Which CreditBookApi the app uses: the real backend, or the mock when
 * EXPO_PUBLIC_USE_MOCK_API is not "false" (same switch as sign-in).
 */
import { USE_MOCK_AUTH } from '@/constants/config';

import { httpCreditBookApi } from './httpCreditBookApi';
import { mockCreditBookApi } from './mockCreditBookApi';

export const creditBookApi = USE_MOCK_AUTH ? mockCreditBookApi : httpCreditBookApi;

/**
 * The bin (delete, undo, restore) needs the backend in CONTRACT_bin.txt.
 * Until it's built, only the mock offers it; then this becomes true.
 */
export const BIN_READY = USE_MOCK_AUTH;
