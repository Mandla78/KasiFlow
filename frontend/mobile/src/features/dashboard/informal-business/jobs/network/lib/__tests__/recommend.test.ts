import { describe, expect, it } from '@jest/globals';

import { closeness, distanceKm, kmText, proof, rankForJob, rankHelpPosts, scoreBuilder, suggest, type Candidate, type Viewer } from '../recommend';
import { tradeFit, tradesText } from '../trades';

const NOW = Date.parse('2026-09-25T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();
const TEMBISA = { latitude: -25.9964, longitude: 28.2268 };
const IVORY_PARK = { latitude: -25.999, longitude: 28.196 };

const me: Viewer = { id: 'me', ...TEMBISA, trades: ['general_builder'], travelKm: 20, partners: ['sipho'] };
const names: Record<string, string> = { sipho: 'Sipho Dube', palesa: 'Palesa M' };
const nameOf = (id: string) => names[id] ?? id;

function builder(id: string, extra: Partial<Candidate> = {}): Candidate {
  return {
    id,
    name: id,
    ...IVORY_PARK,
    trades: ['plumber'],
    travelKm: 20,
    partners: [],
    confirmedStages: 0,
    lastActiveAt: daysAgo(2),
    joinedAt: daysAgo(300),
    ...extra,
  };
}

describe('trades', () => {
  it('ranks trades that work together above the same trade', () => {
    expect(tradeFit(['general_builder'], ['plumber'])).toBe(30);
    expect(tradeFit(['plumber'], ['plumber'])).toBe(15);
    expect(tradeFit(['plumber'], ['welder'])).toBe(5);
  });

  it('reads several trades naturally', () => {
    expect(tradesText(['plumber'])).toBe('Plumber');
    expect(tradesText(['painter', 'tiler'])).toBe('Painter and tiler');
    expect(tradesText(['roofer', 'carpenter', 'welder'])).toBe('Roofer, carpenter and welder');
  });
});

describe('distance and parts', () => {
  it('measures Tembisa to Ivory Park at about 3 km', () => {
    const km = distanceKm(TEMBISA, IVORY_PARK);
    expect(km).toBeGreaterThan(2.8);
    expect(km).toBeLessThan(3.5);
    expect(kmText(km)).toMatch(/^3\.\d km$/);
    expect(kmText(14.6)).toBe('15 km');
    expect(kmText(9.96)).toBe('10 km');
    expect(kmText(Number.NaN)).toBe('near you');
  });

  it('gives no closeness past your travel distance', () => {
    expect(closeness(0, 20)).toBe(20);
    expect(closeness(10, 20)).toBe(10);
    expect(closeness(25, 20)).toBe(0);
  });

  it('log-scales proof so big builders do not take over', () => {
    expect(proof(0)).toBe(0);
    expect(proof(50)).toBeCloseTo(20);
    expect(proof(500)).toBe(20);
    expect(proof(5) / proof(50)).toBeGreaterThan(0.4);
  });
});

describe('scoreBuilder', () => {
  it('puts partners in common first, and explains it', () => {
    const s = scoreBuilder(me, builder('thabo', { partners: ['sipho'], confirmedStages: 12 }), nameOf, NOW);
    expect(s.reason).toBe('Built with Sipho, your partner');
    expect(s.reasons[0]).toBe('Built with Sipho, your partner');
    expect(s.reasons).toContain('12 stages confirmed by clients');
    expect(s.reasons).toContain('Plumbers often work with general builders');
    expect(s.inCommon).toEqual(['Sipho Dube']);
  });

  it('cold start: a new builder with nothing yet is still explained', () => {
    const s = scoreBuilder(me, builder('neo', { joinedAt: daysAgo(5) }), nameOf, NOW);
    expect(s.reason).toBe('New on Akayza');
    const old = scoreBuilder(me, builder('old'), nameOf, NOW);
    expect(old.reason).toMatch(/^Plumber · 3\.\d km$/);
  });
});

describe('suggest', () => {
  it('never suggests yourself', () => {
    const out = suggest(me, [builder('me'), builder('thabo')], nameOf, NOW);
    expect(out.map((s) => s.id)).toEqual(['thabo']);
  });

  it('after the top 3, every third place goes to a new builder', () => {
    const strong = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => builder(id, { confirmedStages: 40 }));
    const fresh = ['n1', 'n2'].map((id) => builder(id, { joinedAt: daysAgo(3) }));
    const out = suggest(me, [...strong, ...fresh], nameOf, NOW).map((s) => s.id);
    expect(out.slice(0, 3).every((id) => !id.startsWith('n'))).toBe(true);
    expect(out[5]).toBe('n1');
    expect(out).toContain('n2');
    expect(out).toHaveLength(8);
  });
});

describe('rankForJob', () => {
  it('only the trade the job needs, and only builders who travel that far', () => {
    const out = rankForJob(
      me,
      TEMBISA,
      'plumber',
      [
        builder('near', { confirmedStages: 2 }),
        builder('proven', { confirmedStages: 30 }),
        builder('wrong-trade', { trades: ['tiler'] }),
        builder('stays-home', { travelKm: 2 }),
      ],
      nameOf,
      NOW,
    );
    expect(out.map((s) => s.id)).toEqual(['proven', 'near']);
    expect(out[0]!.reason).toBe('30 stages confirmed by clients');
  });
});

describe('rankHelpPosts', () => {
  it('shows only your trade, within your travel distance', () => {
    const owner = builder('musa', { confirmedStages: 20 });
    const far = { latitude: -26.4, longitude: 28.2 };
    const out = rankHelpPosts(
      me,
      [
        { id: 'mine-trade', trade: 'general_builder', ...IVORY_PARK, owner },
        { id: 'other-trade', trade: 'plumber', ...IVORY_PARK, owner },
        { id: 'too-far', trade: 'general_builder', ...far, owner },
        { id: 'own-post', trade: 'general_builder', ...IVORY_PARK, owner: builder('me') },
      ],
      NOW,
    );
    expect(out.map((p) => p.id)).toEqual(['mine-trade']);
  });
});
