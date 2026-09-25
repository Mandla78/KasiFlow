/**
 * Which OrderBookApi the app uses. Only the mock exists until the backend
 * in CONTRACT_order_book.txt is approved and built; on the real API the
 * order book stays hidden (ORDER_BOOK_READY), so nothing breaks before then.
 */
import { USE_MOCK_AUTH } from '@/constants/config';

import { mockOrderBookApi, practice } from './mockOrderBookApi';

export const orderBookApi = mockOrderBookApi;

/** The Order book tile and screens show only where orderBookApi works. */
export const ORDER_BOOK_READY = USE_MOCK_AUTH;

/** TEST ONLY (mock): "Test: no signal" plays a dropped network. */
export const practiceSignal = USE_MOCK_AUTH ? practice : null;
