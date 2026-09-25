import { describe, expect, it } from '@jest/globals';

import { amountError, centsToInput, parseRand } from '../amounts';

describe('parseRand: rand typed by a person -> whole cents', () => {
  it.each([
    ['48', 4800],
    ['R48', 4800],
    ['48.5', 4850],
    ['48,50', 4850],
    ['48,5', 4850],
    ['1 200', 120000],
    ['1,200', 120000],
    ['1,200.50', 120050],
    ['1 200,50', 120050],
    ['12,345,678', 1234567800],
    ['0.01', 1],
  ])('%s -> %i', (text, cents) => {
    expect(parseRand(text)).toBe(cents);
  });

  it.each(['48.505', 'abc', '', '-5', '4.8.1'])('refuses %p', (text) => {
    expect(parseRand(text)).toBeNull();
  });
});

describe('centsToInput: cents back to what a person would type', () => {
  it.each([
    [4850, '48.50'],
    [4800, '48'],
    [5, '0.05'],
  ])('%i -> %s', (cents, text) => {
    expect(centsToInput(cents)).toBe(text);
  });
});

describe('amountError: one clear message per problem', () => {
  it.each([
    ['', 'Type the amount'],
    ['0', 'The amount must be more than R0'],
    ['100000', ''],
    ['100000.01', 'The most you can enter is R100,000'],
  ])('%p -> %p', (text, message) => {
    expect(amountError(text)).toBe(message);
  });

  it('uses the caller\'s message above a custom maximum', () => {
    expect(amountError('50', 4000, 'too much')).toBe('too much');
  });
});
