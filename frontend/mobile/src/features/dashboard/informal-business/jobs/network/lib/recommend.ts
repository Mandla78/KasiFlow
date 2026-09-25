/**
 * "Builders you may know" and help-post matching, explainable like the
 * supplier engine (15_JOBS_BUILDER_NETWORK_PLAN.txt §6). Every candidate
 * gets a score out of 100 and the reasons behind it; the top reason goes on
 * the card. Plain arithmetic, no black box. The server will run the same
 * rules; this copy runs the mock.
 *
 *   trade fit            30  trades that work together highest; same trade lower
 *   closeness            20  within your travel distance, nearer is better
 *   mutual connections   20  builders you both know ("triadic closure")
 *   proof                20  stages confirmed by clients, log-scaled
 *   activity             10  active in the last 30 days
 */
import type { At } from '../types';
import { tradeFit, tradeLabel, type Trade } from './trades';

const DAY = 86_400_000;

export type Viewer = At & { id: string; trades: Trade[]; travelKm: number; connections: string[] };

export type Candidate = At & {
  id: string;
  name: string;
  trades: Trade[];
  connections: string[];
  confirmedStages: number;
  lastActiveAt: string;
  joinedAt: string;
};

export type Scored = {
  id: string;
  score: number;
  distanceKm: number;
  /** Names of builders you both know. */
  mutual: string[];
  /** Strongest first. */
  reasons: string[];
  /** The one line for the card. */
  reason: string;
};

/** Straight-line distance (haversine), in km. */
export function distanceKm(a: At, b: At): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** 3.2 -> "3.2 km", 9.96 -> "10 km", 14.6 -> "15 km". */
export function kmText(km: number): string {
  const tenths = Math.round(km * 10) / 10;
  return `${tenths < 10 ? tenths.toFixed(1) : tenths.toFixed(0)} km`;
}

/** Closeness out of 20: full marks next door, nothing past your travel distance. */
export function closeness(km: number, travelKm: number): number {
  if (km > travelKm) return 0;
  return 20 * (1 - km / travelKm);
}

/** Proof out of 20, log-scaled so a few big builders don't take every row (50 stages = full). */
export function proof(confirmedStages: number): number {
  return Math.min(20, (20 * Math.log1p(Math.max(0, confirmedStages))) / Math.log1p(50));
}

/** Out of 20: one builder you both know already counts. */
export function mutualPoints(count: number): number {
  return Math.min(20, count * 8);
}

export function activity(lastActiveAt: string, now: number): number {
  return now - Date.parse(lastActiveAt) <= 30 * DAY ? 10 : 0;
}

export function stagesText(n: number): string {
  return n === 1 ? '1 stage confirmed by a client' : `${n} stages confirmed by clients`;
}

function mutualText(names: string[]): string {
  const first = names[0].split(' ')[0];
  if (names.length === 1) return `Works with ${first}, who you know`;
  if (names.length === 2) return `Knows ${first} and ${names[1].split(' ')[0]}, who you know`;
  return `Knows ${first} and ${names.length - 1} others you know`;
}

function plural(trade: Trade): string {
  return `${tradeLabel(trade).toLowerCase()}s`;
}

export function scoreBuilder(me: Viewer, c: Candidate, nameOf: (id: string) => string, now: number): Scored {
  const km = distanceKm(me, c);
  const mutual = c.connections.filter((id) => me.connections.includes(id)).map(nameOf);
  const parts = {
    trade: tradeFit(me.trades, c.trades),
    closeness: closeness(km, me.travelKm),
    mutual: mutualPoints(mutual.length),
    proof: proof(c.confirmedStages),
    activity: activity(c.lastActiveAt, now),
  };
  const isNew = now - Date.parse(c.joinedAt) <= 30 * DAY;
  const theirs = c.trades[0];
  const mine = me.trades[0];

  const reasons: [number, string][] = [];
  if (mutual.length) reasons.push([parts.mutual + 20, mutualText(mutual)]);
  if (c.confirmedStages > 0) reasons.push([parts.proof, stagesText(c.confirmedStages)]);
  if (parts.trade === 30 && theirs && mine) reasons.push([parts.trade - 15, `${tradeLabel(theirs)}s often work with ${plural(mine)}`]);
  reasons.push([parts.closeness, km <= me.travelKm ? `${kmText(km)} from you` : `${kmText(km)} away, further than you travel`]);
  if (parts.activity) reasons.push([parts.activity - 5, 'Active this month']);
  if (isNew) reasons.push([1, 'New on Akayza']);
  reasons.sort((a, b) => b[0] - a[0]);

  // The card line: who you know, then proof, then "new", then distance.
  const reason = mutual.length
    ? mutualText(mutual)
    : c.confirmedStages > 0
      ? stagesText(c.confirmedStages)
      : isNew
        ? 'New on Akayza'
        : `${tradeLabel(theirs)} · ${kmText(km)}`;

  const score = Math.round(parts.trade + parts.closeness + parts.mutual + parts.proof + parts.activity);
  return { id: c.id, score, distanceKm: km, mutual, reasons: reasons.map((r) => r[1]), reason };
}

/**
 * Builders you may know, best first. Never: yourself, your connections,
 * anyone blocked either way, anyone hidden (the caller leaves them out).
 * Fairness: after the top 3, every third place goes to a builder who joined
 * in the last 30 days, so new builders get their first connection too.
 */
export function suggest(me: Viewer, candidates: Candidate[], nameOf: (id: string) => string, now: number, limit = 12): Scored[] {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const ranked = candidates
    .filter((c) => c.id !== me.id && !me.connections.includes(c.id))
    .map((c) => scoreBuilder(me, c, nameOf, now))
    .sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm);

  const top = ranked.slice(0, 3);
  const isNew = (s: Scored) => now - Date.parse(byId.get(s.id)!.joinedAt) <= 30 * DAY;
  const fresh = ranked.slice(3).filter(isNew);
  const rest = ranked.slice(3).filter((s) => !isNew(s));
  const mixed: Scored[] = [...top];
  while (fresh.length || rest.length) {
    const turn = (mixed.length - 3) % 3 === 2;
    const next = (turn ? fresh.shift() : rest.shift()) ?? fresh.shift() ?? rest.shift();
    if (next) mixed.push(next);
  }
  return mixed.slice(0, limit);
}

export type PostCandidate = At & { id: string; trade: Trade; owner: Candidate };

/**
 * Help posts for you: your trade only, within your travel distance; then
 * nearest, most proof and most active first.
 */
export function rankHelpPosts(me: Viewer, posts: PostCandidate[], now: number): { id: string; distanceKm: number }[] {
  return posts
    .filter((p) => p.owner.id !== me.id && me.trades.includes(p.trade))
    .map((p) => {
      const km = distanceKm(me, p);
      return { id: p.id, distanceKm: km, score: closeness(km, me.travelKm) + proof(p.owner.confirmedStages) + activity(p.owner.lastActiveAt, now) };
    })
    .filter((p) => p.distanceKm <= me.travelKm)
    .sort((a, b) => b.score - a.score)
    .map(({ id, distanceKm: km }) => ({ id, distanceKm: km }));
}
