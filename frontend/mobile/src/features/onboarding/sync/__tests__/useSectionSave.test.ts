/**
 * What a trader reads when a Business profile save fails: the server's own
 * reason for the field, never a vague "something went wrong".
 */
import { expect, jest, test } from '@jest/globals';

import { ApiError } from '@/shared/api/client';

import { firstFieldError, saveErrorMessage } from '../useSectionSave';

jest.mock('@/features/auth/session/SessionProvider', () => ({ useSession: () => ({}) }));
jest.mock('../../api/businessProfileApi', () => ({ businessProfileApi: {}, fromServer: () => ({}), toServer: () => ({}) }));

test('the first field message is found inside the nested 422 errors', () => {
  const errors = [{ business: { cellphone: ['A 10-digit number, like 0821234567.'] } }];
  expect(firstFieldError(errors)).toBe('A 10-digit number, like 0821234567.');
  expect(firstFieldError([])).toBeNull();
  expect(firstFieldError(undefined)).toBeNull();
});

test('a 422 shows the field reason, not the generic line', () => {
  const e = new ApiError(422, 'VALIDATION_ERROR', 'Please check the highlighted fields.', undefined, [{ location: { postal_code: ['Four digits.'] } }]);
  expect(saveErrorMessage(e)).toBe('Four digits.');
});

test('a 422 without field errors falls back to the server message', () => {
  expect(saveErrorMessage(new ApiError(422, 'VALIDATION_ERROR', 'Please check the highlighted fields.'))).toBe('Please check the highlighted fields.');
});

test('offline, too many taps and server errors each say what to do', () => {
  expect(saveErrorMessage(new ApiError(0, 'NETWORK', 'x'))).toMatch(/connection/);
  expect(saveErrorMessage(new ApiError(429, 'RATE_LIMITED', 'x'))).toMatch(/Wait a minute/);
  expect(saveErrorMessage(new ApiError(500, 'ERROR', 'x'))).toMatch(/Try again in a moment/);
  expect(saveErrorMessage(new Error('boom'))).toMatch(/Try again in a moment/);
});
