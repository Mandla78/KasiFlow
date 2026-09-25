/**
 * Orders over the wire: what the app sends (products and quantities only,
 * the pin only for "somewhere else", the Idempotency-Key) and how the
 * server's refusals come back.
 */
import { beforeEach, expect, jest, test } from '@jest/globals';

import { OrderError } from '../../types';
import { httpOrdersApi } from '../httpOrdersApi';

const mockCalls: { method: string; path: string; body: unknown; opts: { headers?: Record<string, string> } }[] = [];
let mockReply: () => unknown = () => ({});

jest.mock('@/shared/api/client', () => {
  class ApiError extends Error {
    status: number;
    code: string;
    constructor(mockStatus: number, mockCode: string, message: string) {
      super(message);
      this.status = mockStatus;
      this.code = mockCode;
    }
  }
  return {
    ApiError,
    api: async (method: string, path: string, body: unknown, opts: { headers?: Record<string, string> }) => {
      mockCalls.push({ method, path, body, opts });
      return mockReply();
    },
  };
});

const WIRE = {
  id: 'o1', reference: 'AKZ-2026-000101', supplier_id: 's1', supplier_name: 'Mahlangu Wholesale', status: 'placed',
  payment: 'cash', payment_status: 'cash_due', fulfilment: 'delivery', address: '14 Andrew Mapheto Drive',
  lines: [{ product_id: 'p1', name: 'Maize meal', pack_size: '10 kg', unit: 'bag', qty: 6, price_cents: 8599, line_total_cents: 51594 }],
  subtotal_cents: 51594, delivery_fee_cents: 3500, total_cents: 55094, placed_at: '2026-09-26T08:00:00Z', pay_by: null,
  events: [{ status: 'placed', at: '2026-09-26T08:00:00Z' }],
};

beforeEach(() => {
  mockCalls.length = 0;
  mockReply = () => ({ order: WIRE });
});

test('placing sends products and quantities only, with the key', async () => {
  const o = await httpOrdersApi.place({
    supplierId: 's1', lines: [{ productId: 'p1', qty: 6 }], fulfilment: 'delivery', payment: 'cash',
    deliveryAddress: 'ignored without a pin', deliveryPoint: null, idempotencyKey: 'k-1',
  });
  expect(mockCalls[0].body).toEqual({
    supplier_id: 's1', lines: [{ product_id: 'p1', qty: 6 }], fulfilment: 'delivery', payment: 'cash', delivery_address: null, delivery_point: null,
  });
  expect(mockCalls[0].opts.headers).toEqual({ 'Idempotency-Key': 'k-1' });
  expect(o).toMatchObject({ reference: 'AKZ-2026-000101', totalCents: 55094, lines: [{ productId: 'p1', priceCents: 8599 }] });
});

test('somewhere else sends its address and pin', async () => {
  await httpOrdersApi.place({
    supplierId: 's1', lines: [{ productId: 'p1', qty: 6 }], fulfilment: 'delivery', payment: 'in_app',
    deliveryAddress: '5 Other Street, Tembisa', deliveryPoint: { latitude: -26.0, longitude: 28.2 },
  });
  expect(mockCalls[0].body).toMatchObject({ delivery_address: '5 Other Street, Tembisa', delivery_point: { latitude: -26.0, longitude: 28.2 } });
});

test("the server's refusal becomes an OrderError with its message", async () => {
  const { ApiError } = jest.requireMock('@/shared/api/client') as { ApiError: new (s: number, c: string, m: string) => Error };
  mockReply = () => {
    throw new ApiError(409, 'BELOW_MINIMUM', "Mahlangu Wholesale's minimum order is R500.");
  };
  const err = await httpOrdersApi.place({ supplierId: 's1', lines: [{ productId: 'p1', qty: 1 }], fulfilment: 'collect', payment: 'cash', deliveryAddress: null }).catch((e) => e);
  expect(err).toBeInstanceOf(OrderError);
  expect(err).toMatchObject({ code: 'BELOW_MINIMUM', message: "Mahlangu Wholesale's minimum order is R500." });
});
