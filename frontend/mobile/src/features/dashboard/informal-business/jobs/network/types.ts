/**
 * The builder network, as the app sees it (docs/teammate/
 * 15_JOBS_BUILDER_NETWORK_PLAN.txt, changed by DECISION_jobs_partners.txt):
 * builders show their client-confirmed builds, and bring each other onto
 * a job as partners, with the pay stated before they accept.
 *
 * What another builder may see is the plan's minimum: name, trades,
 * suburb, proof numbers and the builds they chose. A phone number only
 * between partners (an accepted invite, or picked on a help post). Never a
 * client's name, number or price; never a street address. Money is cents.
 */
import type { ImageSourcePropType } from 'react-native';

import type { Cents } from '@/shared/lib/money';

import type { Trade } from './lib/trades';

export type { Trade };

/** Where the viewer is, for distances. The real API reads it from the session. */
export type At = { latitude: number; longitude: number };

/**
 * none     nothing between you
 * saved    you bookmarked them (they aren't told)
 * partner  you've worked a job together (an accepted invite): numbers are shared
 */
export type Relation = 'none' | 'saved' | 'partner';

/** One photo of a finished stage, confirmed by the client. */
export type WorkItem = {
  id: string;
  /** "Bathroom pipes". */
  stageName: string;
  photo: ImageSourcePropType;
  confirmedAt: string;
};

/** A finished job in a builder's portfolio. */
export type Build = {
  id: string;
  /** "Bathroom extension". */
  title: string;
  /** Suburb only. */
  suburb: string;
  finishedAt: string;
  stagesConfirmed: number;
  stagesTotal: number;
  /** Stage photos, in the order they were built. */
  photos: WorkItem[];
  /** First names of the partners on it. */
  builtWith: string[];
};

/** A builder in a list: enough to decide whether to open them. */
export type BuilderCard = {
  id: string;
  name: string;
  initials: string;
  color: string;
  photoUrl: string | null;
  trades: Trade[];
  suburb: string;
  distanceKm: number;
  /** Jobs clients confirmed from start to finish. */
  buildsConfirmed: number;
  /** Stages clients confirmed (their own jobs and jobs they partnered on). */
  confirmedStages: number;
  /** The first photo of their best build, for lists. */
  cover: ImageSourcePropType | null;
  /** The one reason shown in lists ("Built with Sipho, your partner"). */
  reason: string;
  relation: Relation;
  /** Only between partners. 0XXXXXXXXX. */
  phone: string | null;
};

/** Someone else's builder profile. */
export type BuilderProfile = BuilderCard & {
  about: string;
  onAkayzaSince: string;
  /** First names of builders they've partnered with. */
  workedWith: string[];
  /** Your partners who have also worked with them. */
  partnersInCommon: string[];
  /** Every reason we show them to you, strongest first. */
  reasons: string[];
  builds: Build[];
};

/* ---------- Pay, stated before anyone accepts ---------- */

/** fixed: one amount for the work. per_day: a day rate times the days. */
export type PayKind = 'fixed' | 'per_day';

/** When the partner is paid (cash, between the two builders). */
export type PaidWhen = 'stage_confirmed' | 'daily' | 'end';

export type Offer = {
  kind: PayKind;
  /** The whole amount (fixed) or the day rate (per_day). */
  amountCents: Cents;
  days: number;
  paidWhen: PaidWhen;
};

/**
 * One cash payment to a partner, confirmed by both like the client's
 * sign-off: the owner says what they paid, the partner what they got.
 */
export type PartnerPayment = {
  id: string;
  ownerAmountCents: Cents;
  /** Null until the partner answers. */
  partnerAmountCents: Cents | null;
  status: 'waiting' | 'confirmed' | 'amounts_dont_match';
  paidAt: string;
};

export type PartnerStatus = 'invited' | 'accepted' | 'declined';

/** A partner on one of YOUR jobs (the owner's view). */
export type JobPartner = {
  id: string;
  jobId: string;
  builder: BuilderCard;
  stageNames: string[];
  trade: Trade;
  startsOn: string;
  offer: Offer;
  status: PartnerStatus;
  invitedAt: string;
  payments: PartnerPayment[];
};

/** An invite to work on someone else's job (the partner's view). */
export type Invite = {
  id: string;
  owner: BuilderCard;
  jobTitle: string;
  suburb: string;
  stageNames: string[];
  trade: Trade;
  startsOn: string;
  offer: Offer;
  status: PartnerStatus;
  invitedAt: string;
  payments: PartnerPayment[];
};

/** What you offer when you bring someone in (to a builder, or posted nearby). */
export type NewOffer = {
  stageIds: string[];
  trade: Trade;
  startsOn: string;
  offer: Offer;
};

/* ---------- Help posts: an offer posted nearby ---------- */

export type HelpPostStatus = 'open' | 'filled' | 'closed';

export type HelpResponse = {
  builder: BuilderCard;
  at: string;
  status: 'interested' | 'picked';
};

/** "Plumber needed · Final · Tembisa · R4,500 · 3 days". */
export type HelpPost = {
  id: string;
  jobId: string | null;
  /** Your own posts: the job's title (other builders never see it). */
  jobTitle: string | null;
  owner: BuilderCard | null;
  /** True on your own posts. */
  mine: boolean;
  trade: Trade;
  /** The stages, as words ("Final", "Walls up before the roof"). */
  what: string;
  startsOn: string;
  suburb: string;
  /** From the viewer (0 on your own). */
  distanceKm: number;
  offer: Offer;
  createdAt: string;
  expiresAt: string;
  status: HelpPostStatus;
  /** Someone else's post: you said you're interested. */
  myResponse: 'interested' | null;
  /** Your own post: who answered, best match first. */
  responses: HelpResponse[];
};

/* ---------- Screens' bundles ---------- */

/** The Builders tab, in one call. */
export type BuildersHome = {
  /** Your builder profile is visible to other builders. */
  visible: boolean;
  travelKm: number;
  partners: BuilderCard[];
  saved: BuilderCard[];
  /** Nearby builders (of `trade` when given), best first; not partners or saved. */
  nearby: BuilderCard[];
  helpWanted: HelpPost[];
  myPosts: HelpPost[];
};

/** Who you can bring onto a job for a trade. */
export type Candidates = { partners: BuilderCard[]; saved: BuilderCard[]; nearby: BuilderCard[] };

/** A build of your own, to show or hide. */
export type MyBuild = Build & { shown: boolean };

export type MyBuilderProfile = {
  trades: Trade[];
  about: string;
  travelKm: number;
  /** "Show me to other builders". Off until the builder turns it on. */
  visible: boolean;
  builds: MyBuild[];
};

export type MyBuilderProfileInput = Omit<MyBuilderProfile, 'builds'> & { shownBuildIds: string[] };

export type ReportReason = 'fake' | 'not_their_work' | 'scam' | 'rude' | 'other';

export interface NetworkApi {
  builders(filter: { trade: Trade | null }, at?: At): Promise<BuildersHome>;
  builder(id: string, at?: At): Promise<BuilderProfile>;
  myProfile(): Promise<MyBuilderProfile>;
  saveMyProfile(input: MyBuilderProfileInput): Promise<MyBuilderProfile>;
  /** Bookmark (or un-bookmark) a builder; they aren't told. */
  setSaved(builderId: string, saved: boolean): Promise<void>;
  block(builderId: string): Promise<void>;
  report(builderId: string, reason: ReportReason, note: string): Promise<void>;

  /** Your jobs: who's on them, and who you could bring in. */
  partnersOnJob(jobId: string, at?: At): Promise<JobPartner[]>;
  candidates(jobId: string, trade: Trade, at?: At): Promise<Candidates>;
  invite(jobId: string, builderId: string, input: NewOffer): Promise<JobPartner>;
  /** "I paid Thabo R4,500". */
  recordPayment(partnerId: string, amountCents: Cents): Promise<JobPartner>;

  /** Other builders' jobs you're invited to or working on. */
  invites(at?: At): Promise<Invite[]>;
  getInvite(id: string, at?: At): Promise<Invite>;
  answerInvite(id: string, accept: boolean): Promise<Invite>;
  /** "I got R4,500". */
  confirmPayment(inviteId: string, paymentId: string, amountCents: Cents): Promise<Invite>;

  createHelpPost(jobId: string, input: NewOffer & { suburb: string }): Promise<HelpPost>;
  helpPost(id: string, at?: At): Promise<HelpPost>;
  interested(postId: string): Promise<HelpPost>;
  /** Picking someone makes them your partner on the job, on the post's offer. */
  pick(postId: string, builderId: string): Promise<HelpPost>;
  closeHelpPost(postId: string): Promise<HelpPost>;
}
