/**
 * MOCK builder network: every screen works before the backend exists. It
 * keeps the rules of 15_JOBS_BUILDER_NETWORK_PLAN.txt as changed by
 * DECISION_jobs_partners.txt, and throws the server's kind of errors, so a
 * real networkApi changes no screen:
 *   - partners come from working a job together (an accepted invite, or
 *     picked on a help post); only partners see each other's number
 *   - every invite and help post states the pay before anyone accepts
 *   - payments to a partner are confirmed by both (same amount, or both kept)
 *   - you're shown to others only after "Show me to other builders"
 *   - 30 invites a day, 5 partners per job, 5 open posts, 20 "interested" a day
 *   - blocked builders disappear both ways
 * Kept on the phone (secure storage); memory only in the web preview.
 *
 * `practice` plays the other builder (accept an invite, confirm a payment,
 * pay you), and sample builders answer your help posts a few seconds after
 * you post: screens mark these "Test", like the practice sign-off.
 */
import * as SecureStore from 'expo-secure-store';

import { addDays, daysBetween, todayIso } from '@/features/dashboard/informal-business/credit-book/lib/dueDates';
import { ApiError } from '@/shared/api/client';
import { Cents } from '@/shared/lib/money';

import { mockJobsApi } from '../../api/mockJobsApi';
import type { Job } from '../../types';
import {
  ABOUT_MAX,
  INTERESTED_PER_DAY,
  INVITES_PER_DAY,
  MAX_OPEN_POSTS,
  MAX_PARTNERS_PER_JOB,
  MAX_POST_DAYS,
  MAX_TRADES,
  SUBURB_MAX,
  TRAVEL_CHOICES,
} from '../lib/limits';
import { checkOffer, listText, MAX_OFFER_CENTS, paymentStatus, stillOwed } from '../lib/pay';
import { distanceKm, rankForJob, rankHelpPosts, scoreBuilder, suggest, type Candidate, type Viewer } from '../lib/recommend';
import { TRADES, type Trade } from '../lib/trades';
import type {
  At,
  Build,
  BuilderCard,
  BuilderProfile,
  HelpPost,
  HelpResponse,
  Invite,
  JobPartner,
  MyBuild,
  MyBuilderProfile,
  NetworkApi,
  NewOffer,
  Offer,
  PartnerPayment,
  PartnerStatus,
  Relation,
  ReportReason,
} from '../types';
import { HOME, MY_EARLIER_BUILDS, SAMPLE_BUILDERS, SAMPLE_INVITE, SAMPLE_POSTS, type SampleBuild, type SampleBuilder } from './mockBuilders';

const KEY = 'akayza.mock-network.v2';
const DAY = 86_400_000;
const ME = 'me';
const wait = (ms = 350) => new Promise((r) => setTimeout(r, ms));
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
/** Sample builders answer your help post this long after you post it. */
const ANSWER_AFTER_MS = [4000, 9000];

type Deal = { stageIds: string[]; stageNames: string[]; trade: Trade; startsOn: string; offer: Offer };

type StoredPartner = Deal & { id: string; jobId: string; builderId: string; status: PartnerStatus; invitedAt: string; payments: PartnerPayment[] };

type StoredInvite = Omit<Deal, 'stageIds'> & {
  id: string;
  ownerId: string;
  jobTitle: string;
  suburb: string;
  status: PartnerStatus;
  invitedAt: string;
  payments: PartnerPayment[];
};

type StoredPost = Deal & {
  id: string;
  jobId: string | null;
  jobTitle: string | null;
  ownerId: string;
  what: string;
  suburb: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  status: 'open' | 'filled' | 'closed';
  /** Someone else's post: "me" said interested. */
  interestedAt: string | null;
  /** Your post: who you picked. */
  pickedId: string | null;
};

type State = {
  trades: Trade[];
  about: string;
  travelKm: number;
  visible: boolean;
  hiddenBuildIds: string[];
  saved: string[];
  /** Builders "me" has worked a job with. */
  partners: string[];
  blocked: string[];
  reports: { builderId: string; reason: ReportReason; note: string; at: string }[];
  /** When "me" sent invites / said interested (for the daily limits). */
  invitesSent: string[];
  interestedSent: string[];
  /** Partners on "my" jobs. */
  jobPartners: StoredPartner[];
  /** Other builders' jobs "me" is invited to. */
  invites: StoredInvite[];
  posts: StoredPost[];
};

let state: State | null = null;

function fresh(): State {
  const now = new Date().toISOString();
  const today = todayIso();
  const posts: StoredPost[] = SAMPLE_POSTS.map((p) => {
    const owner = builderById(p.ownerId);
    return {
      id: p.id,
      jobId: null,
      jobTitle: null,
      ownerId: p.ownerId,
      trade: p.trade,
      what: p.what,
      stageIds: [],
      stageNames: [p.what],
      startsOn: addDays(today, p.startsInDays),
      offer: p.offer,
      suburb: owner.suburb,
      latitude: owner.latitude,
      longitude: owner.longitude,
      createdAt: now,
      status: 'open',
      interestedAt: null,
      pickedId: null,
    };
  });
  const inv = SAMPLE_INVITE;
  return {
    trades: ['general_builder'],
    about: '',
    travelKm: 20,
    visible: false,
    hiddenBuildIds: [],
    saved: [],
    partners: SAMPLE_BUILDERS.filter((b) => b.partners.includes(ME)).map((b) => b.id),
    blocked: [],
    reports: [],
    invitesSent: [],
    interestedSent: [],
    jobPartners: [],
    invites: [
      {
        id: inv.id,
        ownerId: inv.ownerId,
        jobTitle: inv.jobTitle,
        suburb: inv.suburb,
        stageNames: inv.stageNames,
        trade: inv.trade,
        startsOn: addDays(today, inv.startsInDays),
        offer: inv.offer,
        status: 'invited',
        invitedAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
        payments: [],
      },
    ],
    posts,
  };
}

async function load(): Promise<State> {
  if (state) return state;
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    state = raw ? (JSON.parse(raw) as State) : fresh();
  } catch {
    state = fresh(); // web preview: memory only
  }
  return state;
}

async function save(next: State) {
  state = next;
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(next));
  } catch {
    // web preview
  }
}

function invalid(field: string, message: string): never {
  throw new ApiError(422, 'VALIDATION_ERROR', message, { errors: { [field]: [message] } });
}

function notFound(what = 'builder'): never {
  throw new ApiError(404, 'NOT_FOUND', `We couldn't find that ${what}.`);
}

function conflict(code: string, message: string): never {
  throw new ApiError(409, code, message);
}

function tooMany(message: string): never {
  throw new ApiError(429, 'RATE_LIMITED', message);
}

function builderById(id: string): SampleBuilder {
  return SAMPLE_BUILDERS.find((b) => b.id === id) ?? notFound();
}

const reachable = (s: State, id: string) => !s.blocked.includes(id);
const first = (name: string) => name.split(' ')[0] ?? name;
const nameOf = (id: string) => SAMPLE_BUILDERS.find((b) => b.id === id)?.name ?? '';

function relationOf(s: State, id: string): Relation {
  if (s.partners.includes(id)) return 'partner';
  return s.saved.includes(id) ? 'saved' : 'none';
}

function viewer(s: State, at: At): Viewer {
  return { id: ME, latitude: at.latitude, longitude: at.longitude, trades: s.trades, travelKm: s.travelKm, partners: s.partners.filter((id) => reachable(s, id)) };
}

function candidate(b: SampleBuilder, now: number): Candidate {
  return {
    id: b.id,
    name: b.name,
    trades: b.trades,
    travelKm: b.travelKm,
    latitude: b.latitude,
    longitude: b.longitude,
    partners: b.partners,
    confirmedStages: b.confirmedStages,
    lastActiveAt: new Date(now - b.activeDaysAgo * DAY).toISOString(),
    joinedAt: new Date(now - b.joinedDaysAgo * DAY).toISOString(),
  };
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

function toBuild(owner: string, b: SampleBuild, i: number, now: number): Build {
  const finishedAt = new Date(now - b.daysAgo * DAY).toISOString();
  return {
    id: `${owner}-b${i}`,
    title: b.title,
    suburb: b.suburb,
    finishedAt,
    stagesConfirmed: b.stages.length,
    stagesTotal: b.stages.length,
    photos: b.stages.flatMap((st, j) => (st.photo ? [{ id: `${owner}-b${i}-s${j}`, stageName: st.name, photo: st.photo, confirmedAt: finishedAt }] : [])),
    builtWith: (b.with ?? []).map((id) => (id === ME ? 'you' : first(nameOf(id)))),
  };
}

/** Their portfolio: builds with at least one photo, newest first. */
function buildsOf(b: SampleBuilder, now: number): Build[] {
  return b.builds
    .map((x, i) => toBuild(b.id, x, i, now))
    .filter((x) => x.photos.length > 0)
    .sort((x, y) => y.finishedAt.localeCompare(x.finishedAt));
}

function card(s: State, b: SampleBuilder, at: At, now: number): BuilderCard {
  const scored = scoreBuilder(viewer(s, at), candidate(b, now), nameOf, now);
  const relation = relationOf(s, b.id);
  const builds = buildsOf(b, now);
  return {
    id: b.id,
    name: b.name,
    initials: initials(b.name),
    color: b.color,
    photoUrl: null,
    trades: b.trades,
    suburb: b.suburb,
    distanceKm: scored.distanceKm,
    buildsConfirmed: b.buildsConfirmed,
    confirmedStages: b.confirmedStages,
    cover: builds[0]?.photos[0]?.photo ?? null,
    reason: scored.reason,
    relation,
    phone: relation === 'partner' ? b.phone : null,
  };
}

function inLastDay(times: string[], now: number): number {
  return times.filter((t) => now - Date.parse(t) < DAY).length;
}

/** Showing yourself to others needs the builder's yes first (POPIA: specific consent). */
function mustBeVisible(s: State) {
  if (!s.visible) conflict('PROFILE_HIDDEN', 'Turn on "Show me to other builders" first, in your builder profile.');
}

function clean(value: string, field: string, max: number, required = true): string {
  const v = value.trim().replace(/\s+/g, ' ');
  if (required && !/\p{L}/u.test(v)) invalid(field, 'Use at least one letter.');
  if (v.length > max) invalid(field, `Use at most ${max} characters.`);
  return v;
}

/** The offer's rules, checked like the server will: the job's own open stages, a start day, a sane pay. */
function checkDeal(job: Job, input: NewOffer): Deal {
  const ids = [...new Set(input.stageIds)];
  const stages = ids.map((id) => job.stages.find((st) => st.id === id) ?? invalid('stage_ids', 'Pick stages of this job.'));
  if (stages.length === 0) invalid('stage_ids', 'Pick at least one stage.');
  if (stages.some((st) => st.status === 'confirmed')) invalid('stage_ids', 'That stage is already confirmed by the client.');
  if (!TRADES.some((t) => t.key === input.trade)) invalid('trade', 'Pick the trade you need.');
  const ahead = daysBetween(todayIso(), input.startsOn);
  if (!(ahead >= 0 && ahead <= 60)) invalid('starts_on', 'Pick a start day in the next 60 days.');
  const problem = checkOffer(input.offer);
  if (problem) invalid('offer', problem);
  if (!['fixed', 'per_day'].includes(input.offer.kind) || !['stage_confirmed', 'daily', 'end'].includes(input.offer.paidWhen)) invalid('offer', 'Pick how and when you pay.');
  // In job order, so "Walls and Roof" reads like the build.
  const ordered = job.stages.filter((st) => ids.includes(st.id));
  return { stageIds: ordered.map((st) => st.id), stageNames: ordered.map((st) => st.name), trade: input.trade, startsOn: input.startsOn, offer: { ...input.offer } };
}

function toJobPartner(s: State, p: StoredPartner, at: At, now: number): JobPartner {
  return {
    id: p.id,
    jobId: p.jobId,
    builder: card(s, builderById(p.builderId), at, now),
    stageNames: p.stageNames,
    trade: p.trade,
    startsOn: p.startsOn,
    offer: p.offer,
    status: p.status,
    invitedAt: p.invitedAt,
    payments: p.payments,
  };
}

function toInvite(s: State, i: StoredInvite, at: At, now: number): Invite {
  return {
    id: i.id,
    owner: card(s, builderById(i.ownerId), at, now),
    jobTitle: i.jobTitle,
    suburb: i.suburb,
    stageNames: i.stageNames,
    trade: i.trade,
    startsOn: i.startsOn,
    offer: i.offer,
    status: i.status,
    invitedAt: i.invitedAt,
    payments: i.payments,
  };
}

function expiresAt(p: StoredPost): string {
  return new Date(Date.parse(p.createdAt) + 7 * DAY).toISOString();
}

/** Open, and not past its 7 days. */
function live(p: StoredPost, now: number): boolean {
  return p.status === 'open' && Date.parse(expiresAt(p)) > now;
}

/** On your post: the sample builders of that trade who "answer", best match first. */
function answerers(s: State, p: StoredPost, now: number): { builder: SampleBuilder; at: number }[] {
  const site = { latitude: p.latitude, longitude: p.longitude };
  const created = Date.parse(p.createdAt);
  return SAMPLE_BUILDERS.filter((b) => b.trades.includes(p.trade) && reachable(s, b.id))
    .map((b) => ({ b, km: distanceKm(site, b) }))
    .filter(({ b, km }) => km <= b.travelKm)
    .sort((x, y) => y.b.confirmedStages - x.b.confirmedStages || x.km - y.km)
    .slice(0, ANSWER_AFTER_MS.length)
    .map(({ b }, i) => ({ builder: b, at: created + ANSWER_AFTER_MS[i]! }))
    .filter((r) => r.at <= now || p.pickedId === r.builder.id);
}

function toPost(s: State, p: StoredPost, at: At, now: number): HelpPost {
  const mine = p.ownerId === ME;
  const responses: HelpResponse[] = mine
    ? answerers(s, p, now).map(({ builder, at: when }) => ({
        builder: card(s, builder, at, now),
        at: new Date(when).toISOString(),
        status: p.pickedId === builder.id ? 'picked' : 'interested',
      }))
    : [];
  return {
    id: p.id,
    jobId: p.jobId,
    jobTitle: mine ? p.jobTitle : null,
    owner: mine ? null : card(s, builderById(p.ownerId), at, now),
    mine,
    trade: p.trade,
    what: p.what,
    startsOn: p.startsOn,
    suburb: p.suburb,
    distanceKm: mine ? 0 : distanceKm(at, p),
    offer: p.offer,
    createdAt: p.createdAt,
    expiresAt: expiresAt(p),
    status: p.status === 'open' && !live(p, now) ? 'closed' : p.status,
    myResponse: p.interestedAt ? 'interested' : null,
    responses,
  };
}

function findPost(s: State, id: string): StoredPost {
  return s.posts.find((p) => p.id === id && (p.ownerId === ME || reachable(s, p.ownerId))) ?? notFound('post');
}

function findJobPartner(s: State, id: string): StoredPartner {
  return s.jobPartners.find((p) => p.id === id && reachable(s, p.builderId)) ?? notFound('partner');
}

function findInvite(s: State, id: string): StoredInvite {
  return s.invites.find((i) => i.id === id && reachable(s, i.ownerId)) ?? notFound('invite');
}

function addPartner(s: State, id: string) {
  if (!s.partners.includes(id)) s.partners = [...s.partners, id];
}

/** Your finished jobs with photos (from the jobs mock), and your earlier build. */
async function myBuilds(s: State): Promise<MyBuild[]> {
  const now = Date.now();
  const fromJobs: Build[] = [];
  try {
    for (const job of await mockJobsApi.list()) {
      const photos = job.stages.flatMap((st) =>
        st.status === 'confirmed' && st.photo ? [{ id: `stage-${st.id}`, stageName: st.name, photo: { uri: st.photo.uri }, confirmedAt: st.confirmedAt ?? job.createdAt }] : [],
      );
      if (job.status === 'done' && photos.length) {
        fromJobs.push({
          id: `job-${job.id}`,
          title: job.title,
          suburb: job.place.split(',')[0]?.trim() ?? '',
          finishedAt: photos[photos.length - 1]!.confirmedAt,
          stagesConfirmed: job.stages.length,
          stagesTotal: job.stages.length,
          photos,
          builtWith: [],
        });
      }
    }
  } catch {
    // no jobs yet
  }
  const earlier = MY_EARLIER_BUILDS.map((b, i) => toBuild(ME, b, i, now));
  return [...fromJobs, ...earlier].map((b) => ({ ...b, shown: !s.hiddenBuildIds.includes(b.id) }));
}

async function me(s: State): Promise<MyBuilderProfile> {
  return { trades: s.trades, about: s.about, travelKm: s.travelKm, visible: s.visible, builds: await myBuilds(s) };
}

export const mockNetworkApi: NetworkApi = {
  async builders({ trade }, at = HOME) {
    await wait();
    const s = await load();
    const now = Date.now();
    const others = SAMPLE_BUILDERS.filter((b) => reachable(s, b.id));
    const rel = (b: SampleBuilder) => relationOf(s, b.id);
    const nearby = suggest(
      viewer(s, at),
      others.filter((b) => rel(b) === 'none' && (!trade || b.trades.includes(trade))).map((b) => candidate(b, now)),
      nameOf,
      now,
    );
    const helpIds = rankHelpPosts(
      viewer(s, at),
      s.posts
        .filter((p) => p.ownerId !== ME && reachable(s, p.ownerId) && live(p, now))
        .map((p) => ({ id: p.id, trade: p.trade, latitude: p.latitude, longitude: p.longitude, owner: candidate(builderById(p.ownerId), now) })),
      now,
    );
    return {
      visible: s.visible,
      travelKm: s.travelKm,
      partners: others.filter((b) => rel(b) === 'partner').map((b) => card(s, b, at, now)),
      saved: others.filter((b) => rel(b) === 'saved').map((b) => card(s, b, at, now)),
      nearby: nearby.map((x) => card(s, builderById(x.id), at, now)),
      helpWanted: helpIds.map(({ id }) => toPost(s, s.posts.find((p) => p.id === id)!, at, now)),
      myPosts: s.posts.filter((p) => p.ownerId === ME && p.status !== 'closed' && Date.parse(expiresAt(p)) > now).map((p) => toPost(s, p, at, now)),
    };
  },

  async builder(id, at = HOME) {
    await wait(250);
    const s = await load();
    if (!reachable(s, id)) notFound();
    const b = builderById(id);
    const now = Date.now();
    const scored = scoreBuilder(viewer(s, at), candidate(b, now), nameOf, now);
    const profile: BuilderProfile = {
      ...card(s, b, at, now),
      about: b.about,
      onAkayzaSince: new Date(now - b.joinedDaysAgo * DAY).toISOString(),
      workedWith: b.partners.filter((p) => reachable(s, p)).map((p) => (p === ME ? 'you' : first(nameOf(p)))),
      partnersInCommon: scored.inCommon,
      reasons: scored.reasons,
      builds: buildsOf(b, now),
    };
    return profile;
  },

  async myProfile() {
    await wait(250);
    return me(await load());
  },

  async saveMyProfile(input) {
    await wait();
    const s = await load();
    const trades = [...new Set(input.trades)];
    if (trades.length < 1 || trades.length > MAX_TRADES || trades.some((t) => !TRADES.some((x) => x.key === t))) {
      invalid('trades', `Pick 1 to ${MAX_TRADES} trades.`);
    }
    const about = clean(input.about, 'about', ABOUT_MAX, false);
    if (!TRAVEL_CHOICES.includes(input.travelKm)) invalid('travel_km', 'Pick how far you travel.');
    const builds = await myBuilds(s);
    const hidden = builds.filter((b) => !input.shownBuildIds.includes(b.id)).map((b) => b.id);
    await save({ ...s, trades, about, travelKm: input.travelKm, visible: input.visible, hiddenBuildIds: hidden });
    return me(state!);
  },

  async setSaved(builderId, saved) {
    await wait(250);
    const s = await load();
    if (!reachable(s, builderId)) notFound();
    builderById(builderId);
    s.saved = saved ? [...new Set([...s.saved, builderId])] : s.saved.filter((id) => id !== builderId);
    await save(s);
  },

  async block(builderId) {
    await wait();
    const s = await load();
    builderById(builderId);
    if (!s.blocked.includes(builderId)) s.blocked = [...s.blocked, builderId];
    s.saved = s.saved.filter((id) => id !== builderId);
    await save(s);
  },

  async report(builderId, reason, note) {
    await wait();
    const s = await load();
    builderById(builderId);
    const text = clean(note, 'note', 200, reason === 'other');
    s.reports = [...s.reports, { builderId, reason, note: text, at: new Date().toISOString() }];
    await save(s);
  },

  async partnersOnJob(jobId, at = HOME) {
    await wait(250);
    const s = await load();
    const now = Date.now();
    return s.jobPartners.filter((p) => p.jobId === jobId && reachable(s, p.builderId)).map((p) => toJobPartner(s, p, at, now));
  },

  async candidates(jobId, trade, at = HOME) {
    await wait();
    const s = await load();
    await mockJobsApi.get(jobId); // 404 if it's not yours
    const now = Date.now();
    const onJob = s.jobPartners.filter((p) => p.jobId === jobId && p.status !== 'declined').map((p) => p.builderId);
    const pool = SAMPLE_BUILDERS.filter((b) => reachable(s, b.id) && !onJob.includes(b.id) && b.trades.includes(trade));
    const rel = (b: SampleBuilder) => relationOf(s, b.id);
    const ranked = rankForJob(viewer(s, at), at, trade, pool.filter((b) => rel(b) === 'none').map((b) => candidate(b, now)), nameOf, now);
    return {
      partners: pool.filter((b) => rel(b) === 'partner').map((b) => card(s, b, at, now)),
      saved: pool.filter((b) => rel(b) === 'saved').map((b) => card(s, b, at, now)),
      nearby: ranked.map((x) => ({ ...card(s, builderById(x.id), at, now), distanceKm: x.distanceKm, reason: x.reason })),
    };
  },

  async invite(jobId, builderId, input) {
    await wait();
    const s = await load();
    mustBeVisible(s);
    const job = await mockJobsApi.get(jobId);
    const deal = checkDeal(job, input);
    if (!reachable(s, builderId)) notFound();
    const b = builderById(builderId);
    if (!b.trades.includes(deal.trade)) invalid('trade', `${first(b.name)} doesn't do that trade.`);
    const now = Date.now();
    const onJob = s.jobPartners.filter((p) => p.jobId === jobId && p.status !== 'declined');
    if (onJob.some((p) => p.builderId === builderId)) conflict('ALREADY_ON_JOB', `${first(b.name)} is already on this job.`);
    if (onJob.length >= MAX_PARTNERS_PER_JOB) conflict('TOO_MANY_PARTNERS', `A job can have ${MAX_PARTNERS_PER_JOB} partners.`);
    if (inLastDay(s.invitesSent, now) >= INVITES_PER_DAY) tooMany(`You've sent ${INVITES_PER_DAY} invites today. Try again tomorrow.`);
    const p: StoredPartner = { ...deal, id: newId('ptn'), jobId, builderId, status: 'invited', invitedAt: new Date(now).toISOString(), payments: [] };
    await save({ ...s, jobPartners: [...s.jobPartners, p], invitesSent: [...s.invitesSent, p.invitedAt] });
    return toJobPartner(state!, p, HOME, now);
  },

  async recordPayment(partnerId, amountCents) {
    await wait();
    const s = await load();
    const p = findJobPartner(s, partnerId);
    if (p.status !== 'accepted') conflict('NOT_ACCEPTED', 'They have to accept the invite first.');
    if (!Number.isInteger(amountCents) || amountCents <= 0 || amountCents > MAX_OFFER_CENTS) invalid('amount_cents', 'Type the cash you paid.');
    p.payments = [...p.payments, { id: newId('pay'), ownerAmountCents: amountCents, partnerAmountCents: null, status: 'waiting', paidAt: new Date().toISOString() }];
    await save(s);
    return toJobPartner(s, p, HOME, Date.now());
  },

  async invites(at = HOME) {
    await wait(250);
    const s = await load();
    const now = Date.now();
    return s.invites.filter((i) => i.status !== 'declined' && reachable(s, i.ownerId)).map((i) => toInvite(s, i, at, now));
  },

  async getInvite(id, at = HOME) {
    await wait(250);
    const s = await load();
    return toInvite(s, findInvite(s, id), at, Date.now());
  },

  async answerInvite(id, accept) {
    await wait();
    const s = await load();
    const i = findInvite(s, id);
    if (i.status !== 'invited') conflict('ALREADY_ANSWERED', 'You already answered this invite.');
    i.status = accept ? 'accepted' : 'declined';
    if (accept) addPartner(s, i.ownerId);
    await save(s);
    return toInvite(s, i, HOME, Date.now());
  },

  async confirmPayment(inviteId, paymentId, amountCents) {
    await wait();
    const s = await load();
    const i = findInvite(s, inviteId);
    const pay = i.payments.find((x) => x.id === paymentId) ?? notFound('payment');
    if (pay.status !== 'waiting') conflict('ALREADY_ANSWERED', 'You already answered this payment.');
    if (!Number.isInteger(amountCents) || amountCents < 0 || amountCents > MAX_OFFER_CENTS) invalid('amount_cents', 'Type the cash you got.');
    pay.partnerAmountCents = amountCents;
    pay.status = paymentStatus(pay.ownerAmountCents, amountCents);
    await save(s);
    return toInvite(s, i, HOME, Date.now());
  },

  async createHelpPost(jobId, input) {
    await wait();
    const s = await load();
    mustBeVisible(s);
    const job = await mockJobsApi.get(jobId);
    const deal = checkDeal(job, input);
    const suburb = clean(input.suburb, 'suburb', SUBURB_MAX);
    if (deal.offer.days > MAX_POST_DAYS) invalid('days', `1 to ${MAX_POST_DAYS} days.`);
    const now = Date.now();
    if (s.posts.filter((p) => p.ownerId === ME && live(p, now)).length >= MAX_OPEN_POSTS) {
      conflict('TOO_MANY_POSTS', `You have ${MAX_OPEN_POSTS} open posts. Close one first.`);
    }
    const post: StoredPost = {
      ...deal,
      id: newId('hp'),
      jobId,
      jobTitle: job.title,
      ownerId: ME,
      what: listText(deal.stageNames),
      suburb,
      latitude: HOME.latitude,
      longitude: HOME.longitude,
      createdAt: new Date(now).toISOString(),
      status: 'open',
      interestedAt: null,
      pickedId: null,
    };
    await save({ ...s, posts: [post, ...s.posts] });
    return toPost(state!, post, HOME, now);
  },

  async helpPost(id, at = HOME) {
    await wait(250);
    const s = await load();
    return toPost(s, findPost(s, id), at, Date.now());
  },

  async interested(postId) {
    await wait();
    const s = await load();
    mustBeVisible(s);
    const p = findPost(s, postId);
    const now = Date.now();
    if (p.ownerId === ME) invalid('post', "That's your own post.");
    if (!live(p, now)) conflict('POST_CLOSED', 'This post is closed.');
    if (!p.interestedAt) {
      if (inLastDay(s.interestedSent, now) >= INTERESTED_PER_DAY) tooMany(`You've answered ${INTERESTED_PER_DAY} posts today. Try again tomorrow.`);
      p.interestedAt = new Date(now).toISOString();
      s.interestedSent = [...s.interestedSent, p.interestedAt];
      await save(s);
    }
    return toPost(s, p, HOME, now);
  },

  async pick(postId, builderId) {
    await wait();
    const s = await load();
    const p = findPost(s, postId);
    const now = Date.now();
    if (p.ownerId !== ME || !p.jobId) notFound('post');
    if (p.status !== 'open') conflict('POST_CLOSED', 'This post is already filled or closed.');
    if (!answerers(s, p, now).some((r) => r.builder.id === builderId)) notFound();
    p.pickedId = builderId;
    p.status = 'filled';
    // They said yes to the post's offer, so they're a partner on the job straight away.
    s.jobPartners = [
      ...s.jobPartners,
      {
        id: newId('ptn'),
        jobId: p.jobId,
        builderId,
        stageIds: p.stageIds,
        stageNames: p.stageNames,
        trade: p.trade,
        startsOn: p.startsOn,
        offer: p.offer,
        status: 'accepted',
        invitedAt: new Date(now).toISOString(),
        payments: [],
      },
    ];
    addPartner(s, builderId);
    await save(s);
    return toPost(s, p, HOME, now);
  },

  async closeHelpPost(postId) {
    await wait();
    const s = await load();
    const p = findPost(s, postId);
    if (p.ownerId !== ME) notFound('post');
    if (p.status === 'open') p.status = 'closed';
    await save(s);
    return toPost(s, p, HOME, Date.now());
  },
};

/**
 * TEST ONLY (mock): plays the other builder, so the whole story can be
 * tried on one phone. Screens show these as "Test: ...".
 */
export const practice = {
  /** The invited builder accepts or declines. */
  async answerAsPartner(partnerId: string, accept: boolean): Promise<void> {
    await wait();
    const s = await load();
    const p = findJobPartner(s, partnerId);
    if (p.status !== 'invited') return;
    p.status = accept ? 'accepted' : 'declined';
    if (accept) addPartner(s, p.builderId);
    await save(s);
  },

  /** The partner confirms your latest payment with the amount they got. */
  async confirmAsPartner(partnerId: string, amountCents?: Cents): Promise<void> {
    await wait();
    const s = await load();
    const p = findJobPartner(s, partnerId);
    const pay = [...p.payments].reverse().find((x) => x.status === 'waiting');
    if (!pay) return;
    pay.partnerAmountCents = amountCents ?? pay.ownerAmountCents;
    pay.status = paymentStatus(pay.ownerAmountCents, pay.partnerAmountCents);
    await save(s);
  },

  /** The job's owner records paying you what's still owed. */
  async ownerPays(inviteId: string): Promise<void> {
    await wait();
    const s = await load();
    const i = findInvite(s, inviteId);
    const owed = stillOwed(i.offer, i.payments);
    if (i.status !== 'accepted' || owed === 0) return;
    i.payments = [...i.payments, { id: newId('pay'), ownerAmountCents: owed, partnerAmountCents: null, status: 'waiting', paidAt: new Date().toISOString() }];
    await save(s);
  },
};
