/**
 * Which OrderBookApi the app uses: the real backend, or the mock when
 * EXPO_PUBLIC_USE_MOCK_API is not "false" (the same switch as sign-in).
 * The tool shows where the trader switched it on (profile.tools.orderBook).
 */
import { USE_MOCK_AUTH } from '@/constants/config';

import { httpOrderBookApi } from './httpOrderBookApi';
import { mockOrderBookApi, practice } from './mockOrderBookApi';

export const orderBookApi = USE_MOCK_AUTH ? mockOrderBookApi : httpOrderBookApi;

/** TEST ONLY (mock): "Test: no signal" plays a dropped network. */
export const practiceSignal = USE_MOCK_AUTH ? practice : null;
