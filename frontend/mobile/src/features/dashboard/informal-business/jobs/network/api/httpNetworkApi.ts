/**
 * The builder network on the server (docs/teammate/feedback/
 * CONTRACT_jobs_v2.txt). snake_case on the wire is mapped to the app's
 * camelCase here and nowhere else. api() attaches the token, refreshes it,
 * and turns refusals into ApiError with the server's message.
 *
 * Where you are comes from your business profile on the server, so the
 * `at` the mock takes is ignored here. Invites, payments and help posts
 * send an Idempotency-Key: a retry on a bad signal lands once.
 */
import { api, newIdempotencyKey } from '@/shared/api/client';

import type {
  Build,
  BuilderCard,
  BuilderProfile,
  BuildersHome,
  Candidates,
  HelpPost,
  Invite,
  JobPartner,
  MyBuilderProfile,
  NetworkApi,
  NewOffer,
  Offer,
  PartnerPayment,
  Relation,
} from '../types';
import type { Trade } from '../lib/trades';

type WireOffer = { kind: Offer['kind']; amount_cents: number; days: number; paid_when: Offer['paidWhen'] };
type WireCard = {
  id: string;
  name: string;
  initials: string;
  color: string;
  photo_url: string | null;
  trades: Trade[];
  suburb: string;
  distance_km: number | null;
  builds_confirmed: number;
  confirmed_stages: number;
  cover_url: string | null;
  reason: string;
  relation: Relation;
  phone: string | null;
};
type WireBuild = {
  id: string;
  title: string;
  suburb: string;
  finished_at: string;
  stages_confirmed: number;
  stages_total: number;
  photos: { id: string; stage_name: string; url: string; confirmed_at: string }[];
  built_with: string[];
  shown?: boolean;
};
type WireProfile = WireCard & { about: string; on_akayza_since: string; worked_with: string[]; partners_in_common: string[]; reasons: string[]; builds: WireBuild[] };
type WirePayment = { id: string; owner_amount_cents: number; partner_amount_cents: number | null; status: PartnerPayment['status']; paid_at: string };
type WireJobPartner = {
  id: string;
  job_id: string;
  builder: WireCard;
  stage_names: string[];
  trade: Trade;
  starts_on: string;
  offer: WireOffer;
  status: JobPartner['status'];
  invited_at: string;
  payments: WirePayment[];
};
type WireInvite = Omit<WireJobPartner, 'builder' | 'job_id'> & { owner: WireCard; job_title: string; suburb: string };
type WirePost = {
  id: string;
  job_id: string | null;
  job_title: string | null;
  owner: WireCard | null;
  mine: boolean;
  trade: Trade;
  what: string;
  starts_on: string;
  suburb: string;
  distance_km: number | null;
  offer: WireOffer;
  created_at: string;
  expires_at: string;
  status: HelpPost['status'];
  my_response: 'interested' | null;
  responses: { builder: WireCard; at: string; status: 'interested' | 'picked' }[];
};

/** A missing pin on either side: no number to show (kmText says "near you"). */
const km = (d: number | null) => (d === null ? Number.NaN : d);

const offer = (o: WireOffer): Offer => ({ kind: o.kind, amountCents: o.amount_cents, days: o.days, paidWhen: o.paid_when });
const wireOffer = (o: Offer): WireOffer => ({ kind: o.kind, amount_cents: o.amountCents, days: o.days, paid_when: o.paidWhen });

function card(c: WireCard): BuilderCard {
  return {
    id: c.id,
    name: c.name,
    initials: c.initials,
    color: c.color,
    photoUrl: c.photo_url,
    trades: c.trades,
    suburb: c.suburb,
    distanceKm: km(c.distance_km),
    buildsConfirmed: c.builds_confirmed,
    confirmedStages: c.confirmed_stages,
    cover: c.cover_url ? { uri: c.cover_url } : null,
    reason: c.reason,
    relation: c.relation,
    phone: c.phone,
  };
}

function build(b: WireBuild): Build {
  return {
    id: b.id,
    title: b.title,
    suburb: b.suburb,
    finishedAt: b.finished_at,
    stagesConfirmed: b.stages_confirmed,
    stagesTotal: b.stages_total,
    photos: b.photos.map((p) => ({ id: p.id, stageName: p.stage_name, photo: { uri: p.url }, confirmedAt: p.confirmed_at })),
    builtWith: b.built_with,
  };
}

const payment = (p: WirePayment): PartnerPayment => ({
  id: p.id,
  ownerAmountCents: p.owner_amount_cents,
  partnerAmountCents: p.partner_amount_cents,
  status: p.status,
  paidAt: p.paid_at,
});

function jobPartner(p: WireJobPartner): JobPartner {
  return {
    id: p.id,
    jobId: p.job_id,
    builder: card(p.builder),
    stageNames: p.stage_names,
    trade: p.trade,
    startsOn: p.starts_on,
    offer: offer(p.offer),
    status: p.status,
    invitedAt: p.invited_at,
    payments: p.payments.map(payment),
  };
}

function invite(i: WireInvite): Invite {
  return {
    id: i.id,
    owner: card(i.owner),
    jobTitle: i.job_title,
    suburb: i.suburb,
    stageNames: i.stage_names,
    trade: i.trade,
    startsOn: i.starts_on,
    offer: offer(i.offer),
    status: i.status,
    invitedAt: i.invited_at,
    payments: i.payments.map(payment),
  };
}

function post(p: WirePost): HelpPost {
  return {
    id: p.id,
    jobId: p.job_id,
    jobTitle: p.job_title,
    owner: p.owner ? card(p.owner) : null,
    mine: p.mine,
    trade: p.trade,
    what: p.what,
    startsOn: p.starts_on,
    suburb: p.suburb,
    distanceKm: km(p.distance_km),
    offer: offer(p.offer),
    createdAt: p.created_at,
    expiresAt: p.expires_at,
    status: p.status,
    myResponse: p.my_response,
    responses: p.responses.map((r) => ({ builder: card(r.builder), at: r.at, status: r.status })),
  };
}

function myProfile(p: { trades: Trade[]; about: string; travel_km: number; visible: boolean; builds: WireBuild[] }): MyBuilderProfile {
  return { trades: p.trades, about: p.about, travelKm: p.travel_km, visible: p.visible, builds: p.builds.map((b) => ({ ...build(b), shown: b.shown ?? true })) };
}

const deal = (d: NewOffer) => ({ stage_ids: d.stageIds, trade: d.trade, starts_on: d.startsOn, offer: wireOffer(d.offer) });
const once = () => ({ auth: true, headers: { 'Idempotency-Key': newIdempotencyKey() } });
const auth = { auth: true };
const id = encodeURIComponent;

export const httpNetworkApi: NetworkApi = {
  async builders({ trade }) {
    const d = await api<{
      visible: boolean;
      travel_km: number;
      partners: WireCard[];
      saved: WireCard[];
      nearby: WireCard[];
      help_wanted: WirePost[];
      my_posts: WirePost[];
    }>('GET', trade ? `/builders?trade=${id(trade)}` : '/builders', undefined, auth);
    const home: BuildersHome = {
      visible: d.visible,
      travelKm: d.travel_km,
      partners: d.partners.map(card),
      saved: d.saved.map(card),
      nearby: d.nearby.map(card),
      helpWanted: d.help_wanted.map(post),
      myPosts: d.my_posts.map(post),
    };
    return home;
  },

  async builder(builderId) {
    const b = (await api<{ builder: WireProfile }>('GET', `/builders/${id(builderId)}`, undefined, auth)).builder;
    const profile: BuilderProfile = {
      ...card(b),
      about: b.about,
      onAkayzaSince: b.on_akayza_since,
      workedWith: b.worked_with,
      partnersInCommon: b.partners_in_common,
      reasons: b.reasons,
      builds: b.builds.map(build),
    };
    return profile;
  },

  async myProfile() {
    return myProfile((await api<{ profile: Parameters<typeof myProfile>[0] }>('GET', '/me/builder-profile', undefined, auth)).profile);
  },

  async saveMyProfile(input) {
    const body = { trades: input.trades, about: input.about, travel_km: input.travelKm, visible: input.visible, shown_job_ids: input.shownBuildIds };
    return myProfile((await api<{ profile: Parameters<typeof myProfile>[0] }>('PUT', '/me/builder-profile', body, auth)).profile);
  },

  async setSaved(builderId, saved) {
    await api(saved ? 'PUT' : 'DELETE', `/builders/${id(builderId)}/save`, undefined, auth);
  },

  async block(builderId) {
    await api('POST', `/builders/${id(builderId)}/block`, undefined, auth);
  },

  async report(builderId, reason, note) {
    await api('POST', `/builders/${id(builderId)}/report`, { reason, note }, auth);
  },

  async partnersOnJob(jobId) {
    return (await api<{ partners: WireJobPartner[] }>('GET', `/me/jobs/${id(jobId)}/partners`, undefined, auth)).partners.map(jobPartner);
  },

  async candidates(jobId, trade) {
    const d = await api<{ partners: WireCard[]; saved: WireCard[]; nearby: WireCard[] }>('GET', `/me/jobs/${id(jobId)}/candidates?trade=${id(trade)}`, undefined, auth);
    const out: Candidates = { partners: d.partners.map(card), saved: d.saved.map(card), nearby: d.nearby.map(card) };
    return out;
  },

  async invite(jobId, builderId, input) {
    return jobPartner((await api<{ partner: WireJobPartner }>('POST', `/me/jobs/${id(jobId)}/partners`, { builder_id: builderId, ...deal(input) }, once())).partner);
  },

  async recordPayment(partnerId, amountCents) {
    return jobPartner((await api<{ partner: WireJobPartner }>('POST', `/me/job-partners/${id(partnerId)}/payments`, { amount_cents: amountCents }, once())).partner);
  },

  async invites() {
    return (await api<{ invites: WireInvite[] }>('GET', '/me/partner-invites', undefined, auth)).invites.map(invite);
  },

  async getInvite(inviteId) {
    return invite((await api<{ invite: WireInvite }>('GET', `/me/partner-invites/${id(inviteId)}`, undefined, auth)).invite);
  },

  async answerInvite(inviteId, accept) {
    return invite((await api<{ invite: WireInvite }>('POST', `/me/partner-invites/${id(inviteId)}/answer`, { accept }, auth)).invite);
  },

  async confirmPayment(inviteId, paymentId, amountCents) {
    const path = `/me/partner-invites/${id(inviteId)}/payments/${id(paymentId)}/confirm`;
    return invite((await api<{ invite: WireInvite }>('POST', path, { amount_cents: amountCents }, auth)).invite);
  },

  async createHelpPost(jobId, input) {
    return post((await api<{ post: WirePost }>('POST', `/me/jobs/${id(jobId)}/help-posts`, { ...deal(input), suburb: input.suburb }, once())).post);
  },

  async helpPost(postId) {
    return post((await api<{ post: WirePost }>('GET', `/help-posts/${id(postId)}`, undefined, auth)).post);
  },

  async interested(postId) {
    return post((await api<{ post: WirePost }>('POST', `/help-posts/${id(postId)}/interested`, undefined, auth)).post);
  },

  async pick(postId, builderId) {
    return post((await api<{ post: WirePost }>('POST', `/me/help-posts/${id(postId)}/pick`, { builder_id: builderId }, auth)).post);
  },

  async closeHelpPost(postId) {
    return post((await api<{ post: WirePost }>('POST', `/me/help-posts/${id(postId)}/close`, undefined, auth)).post);
  },
};
