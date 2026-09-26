import { describe, expect, it } from '@jest/globals';

import { newOrderKey, randomKey } from '../keys';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('order keys', () => {
  it('the fallback (phones without crypto.randomUUID) is a v4 UUID the server accepts', () => {
    for (let i = 0; i < 200; i++) expect(randomKey()).toMatch(UUID_V4);
  });

  it('keys differ', () => {
    const keys = new Set(Array.from({ length: 1000 }, randomKey));
    expect(keys.size).toBe(1000);
  });

  it('newOrderKey is a UUID either way', () => {
    expect(newOrderKey()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
