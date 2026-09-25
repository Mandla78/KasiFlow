/**
 * Which builders to show, explainable like the supplier engine
 * (15_JOBS_BUILDER_NETWORK_PLAN.txt §6, with partners instead of
 * connections: DECISION_jobs_partners.txt). Every candidate gets a score
 * out of 100 and the reasons behind it; the top reason goes in lists.
 * Plain arithmetic, no black box. The server will run the same rules; this
 * copy runs the mock.
 *
 *   trade fit            30  trades that work together highest; same trade lower
 *   closeness            20  within your travel distance, nearer is better
 *   partners in common   20  builders you've both worked with ("triadic closure")
 *   proof                20  stages confirmed by clients, log-scaled
 *   activity             10  active in the last 30 days
 */
import type { At } from '../types';
import { tradeFit, tradeLabel, type Trade } from './trades';

const DAY = 86_400_000;

export type Viewer = At & { id: string; trades: Trade[]; travelKm: number; partners: string[] };

export type Candidate = At & {
  id: string;
  name: string;
  trades: Trade[];
  /** How far they travel for work. */
  travelKm: number;
  /** Builders they've worked a job with. */
  partners: string[];
  confirmedStages: number;
  lastActiveAt: string;
  joinedAt: string;
};

export type Scored = {
  id: string;
  score: number;
  distanceKm: number;
  /** Names of your partners who've also worked with them. */
  inCommon: string[];
  /** Strongest first. */
  reasons: string[];
  /** The one line for lists. */
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

/** Closeness out of 20: full marks next door, nothing past the travel distance. */
export function closeness(km: number, travelKm: number): number {
  if (km > travelKm) return 0;
  return 20 * (1 - km / travelKm);
}

/** Proof out of 20, log-scaled so a few big builders don't take every place (50 stages = full). */
export function proof(confirmedStages: number): number {
  return Math.min(20, (20 * Math.log1p(Math.max(0, confirmedStages))) / Math.log1p(50));
}

/** Out of 20: one partner in common already counts. */
export function inCommonPoints(count: number): number {
  return Math.min(20, count * 8);
}

export function activity(lastActiveAt: string, now: number): number {
  return now - Date.parse(lastActiveAt) <= 30 * DAY ? 10 : 0;
}

export function stagesText(n: number): string {
  return n === 1 ? '1 stage confirmed by a client' : `${n} stages confirmed by clients`;
}

const first = (name: string) => name.split(' ')[0] ?? name;

function inCommonText(names: string[]): string {
  if (names.length === 1) return `Built with ${first(names[0]!)}, your partner`;
  if (names.length === 2) return `Built with ${first(names[0]!)} and ${first(names[1]!)}, your partners`;
  return `Built with ${first(names[0]!)} and ${names.length - 1} other partners of yours`;
}

function plural(trade: Trade): string {
  return `${tradeLabel(trade).toLowerCase()}s`;
}

export function scoreBuilder(me: Viewer, c: Candidate, nameOf: (id: string) => string, now: number): Scored {
  const km = distanceKm(me, c);
  const inCommon = c.partners.filter((id) => me.partners.includes(id)).map(nameOf);
  const parts = {
    trade: tradeFit(me.trades, c.trades),
    closeness: closeness(km, me.travelKm),
    inCommon: inCommonPoints(inCommon.length),
    proof: proof(c.confirmedStages),
    activity: activity(c.lastActiveAt, now),
  };
  const isNew = now - Date.parse(c.joinedAt) <= 30 * DAY;
  const theirs = c.trades[0];
  const mine = me.trades[0];

  const reasons: [number, string][] = [];
  if (inCommon.length) reasons.push([parts.inCommon + 20, inCommonText(inCommon)]);
  if (c.confirmedStages > 0) reasons.push([parts.proof, stagesText(c.confirmedStages)]);
  if (parts.trade === 30 && theirs && mine) reasons.push([parts.trade - 15, `${tradeLabel(theirs)}s often work with ${plural(mine)}`]);
  reasons.push([parts.closeness, km <= me.travelKm ? `${kmText(km)} from you` : `${kmText(km)} away, further than you travel`]);
  if (parts.activity) reasons.push([parts.activity - 5, 'Active this month']);
  if (isNew) reasons.push([1, 'New on Akayza']);
  reasons.sort((a, b) => b[0] - a[0]);

  // The list line: partners in common, then proof, then "new", then distance.
  const reason = inCommon.length
    ? inCommonText(inCommon)
    : c.confirmedStages > 0
      ? stagesText(c.confirmedStages)
      : isNew
        ? 'New on Akayza'
        : `${theirs ? tradeLabel(theirs) : 'Builder'} · ${kmText(km)}`;

  const score = Math.round(parts.trade + parts.closeness + parts.inCommon + parts.proof + parts.activity);
  return { id: c.id, score, distanceKm: km, inCommon, reasons: reasons.map((r) => r[1]), reason };
}

/**
 * Builders near you, best first (the caller leaves out yourself, your
 * partners, saved and blocked builders). Fairness: after the top 3, every
 * third place goes to a builder who joined in the last 30 days, so new
 * builders get their first job with someone too.
 */
export function suggest(me: Viewer, candidates: Candidate[], nameOf: (id: string) => string, now: number, limit = 12): Scored[] {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const ranked = candidates
    .filter((c) => c.id !== me.id)
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

/**
 * Who could do this trade on a job at `site`: that trade only, and only
 * builders the job is within travel distance for; then nearest, most
 * proof, partners in common and most active first.
 */
export function rankForJob(me: Viewer, site: At, trade: Trade, candidates: Candidate[], nameOf: (id: string) => string, now: number): Scored[] {
  return candidates
    .filter((c) => c.id !== me.id && c.trades.includes(trade))
    .map((c) => {
      const km = distanceKm(site, c);
      const s = scoreBuilder({ ...me, ...site, trades: [trade] }, c, nameOf, now);
      return { ...s, distanceKm: km, score: Math.round(closeness(km, c.travelKm) + proof(c.confirmedStages) + inCommonPoints(s.inCommon.length) + activity(c.lastActiveAt, now)), fits: km <= c.travelKm };
    })
    .filter((s) => s.fits)
    .sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm)
    .map(({ fits: _fits, ...s }) => s);
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
