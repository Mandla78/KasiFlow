/**
 * MOCK builder network: every screen works before the backend exists. It
 * keeps the plan's rules (15_JOBS_BUILDER_NETWORK_PLAN.txt) and throws the
 * server's kind of errors, so a real networkApi changes no screen:
 *   - a phone number only between connected builders, or once picked
 *   - you're shown to others only after "Show me to other builders"
 *   - 30 connection requests a day, 5 open help posts, 20 "I'm interested" a day
 *   - blocked builders disappear both ways
 * Kept on the phone (secure storage); memory only in the web preview.
 *
 * On your own help post, the sample builders of that trade answer a few
 * seconds after you post (screens say "Test"), so the whole story can be
 * tried alone.
 */
import * as SecureStore from 'expo-secure-store';

import { addDays, daysBetween, todayIso } from '@/features/dashboard/informal-business/credit-book/lib/dueDates';
import { ApiError } from '@/shared/api/client';

import { mockJobsApi } from '../../api/mockJobsApi';
import {
  ABOUT_MAX,
  INTERESTED_PER_DAY,
  MAX_OPEN_POSTS,
  MAX_POST_DAYS,
  MAX_TRADES,
  REQUESTS_PER_DAY,
  SUBURB_MAX,
  TRAVEL_CHOICES,
  WHAT_MAX,
} from '../lib/limits';
import { distanceKm, rankHelpPosts, scoreBuilder, suggest, type Candidate, type Viewer } from '../lib/recommend';
import { TRADES, type Trade } from '../lib/trades';
import type {
  At,
  BuilderCard,
  BuilderProfile,
  ConnectionState,
  HelpPost,
  HelpResponse,
  MyBuilderProfile,
  MyWorkItem,
  NetworkApi,
  NewHelpPost,
  ReportReason,
  WorkItem,
} from '../types';
import { HOME, MY_EARLIER_WORK, SAMPLE_BUILDERS, SAMPLE_POSTS, SAMPLE_REQUESTS, type SampleBuilder } from './mockBuilders';

const KEY = 'akayza.mock-network.v1';
const DAY = 86_400_000;
const ME = 'me';
const wait = (ms = 350) => new Promise((r) => setTimeout(r, ms));
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** The sample builders answer your post this long after you post it. */
const ANSWER_AFTER_MS = [4000, 9000];

type StoredPost = {
  id: string;
  jobId: string | null;
  ownerId: string;
  trade: Trade;
  what: string;
  startsOn: string;
  days: number;
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
  hiddenWorkIds: string[];
  /** Builder id -> where "me" stands with them. */
  links: Record<string, ConnectionState | 'ignored'>;
  blocked: string[];
  reports: { builderId: string; reason: ReportReason; note: string; at: string }[];
  /** When "me" sent requests / said interested (for the daily limits). */
  requestsSent: string[];
  interestedSent: string[];
  posts: StoredPost[];
};

let state: State | null = null;

function fresh(): State {
  const now = new Date().toISOString();
  const links: State['links'] = {};
  for (const b of SAMPLE_BUILDERS) if (b.connections.includes(ME)) links[b.id] = 'connected';
  for (const id of SAMPLE_REQUESTS) links[id] = 'incoming';
  const today = todayIso();
  const posts: StoredPost[] = SAMPLE_POSTS.map((p) => {
    const owner = builderById(p.ownerId);
    return {
      id: p.id,
      jobId: null,
      ownerId: p.ownerId,
      trade: p.trade,
      what: p.what,
      startsOn: addDays(today, p.startsInDays),
      days: p.days,
      suburb: owner.suburb,
      latitude: owner.latitude,
      longitude: owner.longitude,
      createdAt: now,
      status: 'open',
      interestedAt: null,
      pickedId: null,
    };
  });
  return {
    trades: ['general_builder'],
    about: '',
    travelKm: 20,
    visible: false,
    hiddenWorkIds: [],
    links,
    blocked: [],
    reports: [],
    requestsSent: [],
    interestedSent: [],
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

function builderById(id: string): SampleBuilder {
  return SAMPLE_BUILDERS.find((b) => b.id === id) ?? notFound();
}

/** Blocked either way: they don't exist for you. */
function reachable(s: State, id: string): boolean {
  return !s.blocked.includes(id);
}

function linkOf(s: State, id: string): ConnectionState {
  const l = s.links[id];
  return l === 'ignored' || !l ? 'none' : l;
}

function connectedIds(s: State): string[] {
  return Object.entries(s.links)
    .filter(([id, l]) => l === 'connected' && reachable(s, id))
    .map(([id]) => id);
}

function viewer(s: State, at: At): Viewer {
  return { id: ME, latitude: at.latitude, longitude: at.longitude, trades: s.trades, travelKm: s.travelKm, connections: connectedIds(s) };
}

function candidate(b: SampleBuilder, now: number): Candidate {
  return {
    id: b.id,
    name: b.name,
    trades: b.trades,
    latitude: b.latitude,
    longitude: b.longitude,
    connections: b.connections,
    confirmedStages: b.confirmedStages,
    lastActiveAt: new Date(now - b.activeDaysAgo * DAY).toISOString(),
    joinedAt: new Date(now - b.joinedDaysAgo * DAY).toISOString(),
  };
}

const nameOf = (id: string) => SAMPLE_BUILDERS.find((b) => b.id === id)?.name ?? '';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

function workOf(b: SampleBuilder, now: number): WorkItem[] {
  return b.work.map((w, i) => ({
    id: `${b.id}-w${i}`,
    stageName: w.stageName,
    jobTitle: w.jobTitle,
    suburb: w.suburb,
    photo: w.file,
    confirmedAt: new Date(now - w.daysAgo * DAY).toISOString(),
  }));
}

function card(s: State, b: SampleBuilder, at: At, now: number, picked = false): BuilderCard {
  const scored = scoreBuilder(viewer(s, at), candidate(b, now), nameOf, now);
  const connection = linkOf(s, b.id);
  return {
    id: b.id,
    name: b.name,
    initials: initials(b.name),
    color: b.color,
    photoUrl: null,
    trades: b.trades,
    suburb: b.suburb,
    distanceKm: scored.distanceKm,
    confirmedStages: b.confirmedStages,
    jobsDone: b.jobsDone,
    reason: scored.reason,
    connection,
    phone: connection === 'connected' || picked ? b.phone : null,
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
  const at = { latitude: p.latitude, longitude: p.longitude };
  const created = Date.parse(p.createdAt);
  return SAMPLE_BUILDERS.filter((b) => b.trades.includes(p.trade) && reachable(s, b.id))
    .map((b) => ({ b, km: distanceKm(at, b) }))
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
        builder: card(s, builder, at, now, p.pickedId === builder.id),
        at: new Date(when).toISOString(),
        status: p.pickedId === builder.id ? 'picked' : 'interested',
      }))
    : [];
  return {
    id: p.id,
    jobId: p.jobId,
    owner: mine ? null : card(s, builderById(p.ownerId), at, now),
    mine,
    trade: p.trade,
    what: p.what,
    startsOn: p.startsOn,
    days: p.days,
    suburb: p.suburb,
    distanceKm: mine ? 0 : distanceKm(at, p),
    createdAt: p.createdAt,
    expiresAt: expiresAt(p),
    status: p.status === 'open' && !live(p, now) ? 'closed' : p.status,
    myResponse: p.interestedAt ? 'interested' : null,
    responses,
  };
}

function inLastDay(times: string[], now: number): number {
  return times.filter((t) => now - Date.parse(t) < DAY).length;
}

function tooMany(message: string): never {
  throw new ApiError(429, 'RATE_LIMITED', message);
}

/** Showing yourself to others needs the builder's yes first (POPIA: specific consent). */
function mustBeVisible(s: State) {
  if (!s.visible) throw new ApiError(409, 'PROFILE_HIDDEN', 'Turn on "Show me to other builders" first, in your builder profile.');
}

function clean(value: string, field: string, max: number, required = true): string {
  const v = value.trim().replace(/\s+/g, ' ');
  if (required && !/\p{L}/u.test(v)) invalid(field, 'Use at least one letter.');
  if (v.length > max) invalid(field, `Use at most ${max} characters.`);
  return v;
}

async function myWork(s: State): Promise<MyWorkItem[]> {
  const now = Date.now();
  const fromJobs: WorkItem[] = [];
  try {
    for (const job of await mockJobsApi.list()) {
      for (const st of job.stages) {
        if (st.status === 'confirmed' && st.photo) {
          fromJobs.push({
            id: `stage-${st.id}`,
            stageName: st.name,
            jobTitle: job.title,
            suburb: job.place.split(',')[0]?.trim() ?? '',
            photo: { uri: st.photo.uri },
            confirmedAt: st.confirmedAt ?? job.createdAt,
          });
        }
      }
    }
  } catch {
    // no jobs yet
  }
  const earlier: WorkItem[] = MY_EARLIER_WORK.map((w, i) => ({
    id: `me-w${i}`,
    stageName: w.stageName,
    jobTitle: w.jobTitle,
    suburb: w.suburb,
    photo: w.file,
    confirmedAt: new Date(now - w.daysAgo * DAY).toISOString(),
  }));
  return [...fromJobs, ...earlier].map((w) => ({ ...w, shown: !s.hiddenWorkIds.includes(w.id) }));
}

async function me(s: State): Promise<MyBuilderProfile> {
  return { trades: s.trades, about: s.about, travelKm: s.travelKm, visible: s.visible, work: await myWork(s) };
}

function findPost(s: State, id: string): StoredPost {
  return s.posts.find((p) => p.id === id && (p.ownerId === ME || reachable(s, p.ownerId))) ?? notFound('post');
}

export const mockNetworkApi: NetworkApi = {
  async forYou(at = HOME) {
    await wait();
    const s = await load();
    const now = Date.now();
    const others = SAMPLE_BUILDERS.filter((b) => reachable(s, b.id));
    const scored = suggest(
      viewer(s, at),
      others.filter((b) => linkOf(s, b.id) !== 'incoming').map((b) => candidate(b, now)),
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
      requests: others
        .filter((b) => linkOf(s, b.id) === 'incoming')
        .map((b) => ({ id: `req-${b.id}`, from: card(s, b, at, now), sentAt: new Date(now - 2 * 3600_000).toISOString() })),
      suggestions: scored.map((x) => card(s, builderById(x.id), at, now)),
      helpWanted: helpIds.map(({ id }) => toPost(s, s.posts.find((p) => p.id === id)!, at, now)),
      myPosts: s.posts
        .filter((p) => p.ownerId === ME && p.status !== 'closed' && Date.parse(expiresAt(p)) > now)
        .map((p) => toPost(s, p, at, now)),
      people: others.filter((b) => linkOf(s, b.id) === 'connected').map((b) => card(s, b, at, now)),
    };
  },

  async builder(id, at = HOME) {
    await wait(250);
    const s = await load();
    if (!reachable(s, id)) notFound();
    const b = builderById(id);
    const now = Date.now();
    const scored = scoreBuilder(viewer(s, at), candidate(b, now), nameOf, now);
    const pickedByMe = s.posts.some((p) => p.ownerId === ME && p.pickedId === id);
    const profile: BuilderProfile = {
      ...card(s, b, at, now, pickedByMe),
      about: b.about,
      onAkayzaSince: new Date(now - b.joinedDaysAgo * DAY).toISOString(),
      mutual: scored.mutual,
      reasons: scored.reasons,
      work: workOf(b, now),
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
    const work = await myWork(s);
    const hidden = work.filter((w) => !input.shownWorkIds.includes(w.id)).map((w) => w.id);
    await save({ ...s, trades, about, travelKm: input.travelKm, visible: input.visible, hiddenWorkIds: hidden });
    return me(state!);
  },

  async connect(builderId) {
    await wait();
    const s = await load();
    mustBeVisible(s);
    if (!reachable(s, builderId)) notFound();
    builderById(builderId);
    const now = Date.now();
    const link = linkOf(s, builderId);
    if (link === 'connected' || link === 'requested') return;
    if (link === 'incoming') {
      s.links[builderId] = 'connected';
    } else {
      if (inLastDay(s.requestsSent, now) >= REQUESTS_PER_DAY) tooMany(`You've sent ${REQUESTS_PER_DAY} requests today. Try again tomorrow.`);
      s.links[builderId] = 'requested';
      s.requestsSent = [...s.requestsSent, new Date(now).toISOString()];
    }
    await save(s);
  },

  async accept(requestId) {
    await wait();
    const s = await load();
    mustBeVisible(s);
    const id = requestId.replace(/^req-/, '');
    if (linkOf(s, id) !== 'incoming' || !reachable(s, id)) notFound('request');
    s.links[id] = 'connected';
    await save(s);
  },

  async ignore(requestId) {
    await wait();
    const s = await load();
    const id = requestId.replace(/^req-/, '');
    if (linkOf(s, id) !== 'incoming') notFound('request');
    // They're not told. The server keeps them from asking again for 30 days.
    s.links[id] = 'ignored';
    await save(s);
  },

  async block(builderId) {
    await wait();
    const s = await load();
    builderById(builderId);
    if (!s.blocked.includes(builderId)) s.blocked = [...s.blocked, builderId];
    delete s.links[builderId];
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

  async createHelpPost(jobId, input: NewHelpPost) {
    await wait();
    const s = await load();
    mustBeVisible(s);
    await mockJobsApi.get(jobId); // 404 if it's not yours
    const now = Date.now();
    if (!TRADES.some((t) => t.key === input.trade)) invalid('trade', 'Pick the trade you need.');
    const what = clean(input.what, 'what', WHAT_MAX);
    const suburb = clean(input.suburb, 'suburb', SUBURB_MAX);
    const today = todayIso();
    const ahead = daysBetween(today, input.startsOn);
    if (!(ahead >= 0 && ahead <= 60)) invalid('starts_on', 'Pick a start day in the next 60 days.');
    if (!Number.isInteger(input.days) || input.days < 1 || input.days > MAX_POST_DAYS) invalid('days', `1 to ${MAX_POST_DAYS} days.`);
    if (s.posts.filter((p) => p.ownerId === ME && live(p, now)).length >= MAX_OPEN_POSTS) {
      throw new ApiError(409, 'TOO_MANY_POSTS', `You have ${MAX_OPEN_POSTS} open posts. Close one first.`);
    }
    const post: StoredPost = {
      id: newId('hp'),
      jobId,
      ownerId: ME,
      trade: input.trade,
      what,
      startsOn: input.startsOn,
      days: input.days,
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
    if (!live(p, now)) throw new ApiError(409, 'POST_CLOSED', 'This post is closed.');
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
    if (p.ownerId !== ME) notFound('post');
    if (p.status !== 'open') throw new ApiError(409, 'POST_CLOSED', 'This post is already filled or closed.');
    if (!answerers(s, p, now).some((r) => r.builder.id === builderId)) notFound();
    p.pickedId = builderId;
    p.status = 'filled';
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
