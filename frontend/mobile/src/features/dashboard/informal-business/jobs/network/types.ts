/**
 * The builder network, as the app sees it (docs/teammate/
 * 15_JOBS_BUILDER_NETWORK_PLAN.txt): builders find each other, see each
 * other's client-confirmed work, connect, and ask for help on a job.
 *
 * What another builder may see is the plan's minimum: name, trades,
 * suburb, proof numbers and the work they chose. A phone number only once
 * connected (or picked on a help post). Never a client's name or number,
 * never a street address.
 */
import type { ImageSourcePropType } from 'react-native';

import type { Trade } from './lib/trades';

export type { Trade };

/** Where the viewer is, for distances. The real API reads it from the session. */
export type At = { latitude: number; longitude: number };

/**
 * none       not connected
 * requested  you asked; waiting for them
 * incoming   they asked you
 * connected  both said yes: numbers are shared
 */
export type ConnectionState = 'none' | 'requested' | 'incoming' | 'connected';

/** One photo of a finished stage, confirmed by the client. */
export type WorkItem = {
  id: string;
  /** "Bathroom plumbing". */
  stageName: string;
  /** "Room extension". */
  jobTitle: string;
  /** Suburb only. */
  suburb: string;
  photo: ImageSourcePropType;
  confirmedAt: string;
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
  /** Stages clients confirmed on their jobs (and on jobs they crewed). */
  confirmedStages: number;
  jobsDone: number;
  /** The one reason shown on the card ("Works with Sipho, who you know"). */
  reason: string;
  connection: ConnectionState;
  /** Only when connected (or picked on your help post). 0XXXXXXXXX. */
  phone: string | null;
};

/** Someone else's builder profile. */
export type BuilderProfile = BuilderCard & {
  /** One line: "Bathrooms and kitchens, neat and on time". */
  about: string;
  onAkayzaSince: string;
  /** Builders you both know. */
  mutual: string[];
  /** Every reason we suggest them, strongest first. */
  reasons: string[];
  work: WorkItem[];
};

export type ConnectionRequest = { id: string; from: BuilderCard; sentAt: string };

export type HelpPostStatus = 'open' | 'filled' | 'closed';

export type HelpResponse = {
  builder: BuilderCard;
  at: string;
  status: 'interested' | 'picked';
};

/** "Plumber needed · bathroom · Ivory Park · from Mon, 2 days". */
export type HelpPost = {
  id: string;
  jobId: string | null;
  owner: BuilderCard | null;
  /** True on your own posts. */
  mine: boolean;
  trade: Trade;
  what: string;
  /** ISO day. */
  startsOn: string;
  days: number;
  suburb: string;
  /** From the viewer (0 on your own). */
  distanceKm: number;
  createdAt: string;
  expiresAt: string;
  status: HelpPostStatus;
  /** Someone else's post: you said you're interested (or were picked). */
  myResponse: 'interested' | 'picked' | null;
  /** Your own post: who answered, best match first. */
  responses: HelpResponse[];
};

export type NewHelpPost = {
  trade: Trade;
  what: string;
  startsOn: string;
  days: number;
  suburb: string;
};

/** Everything the For you tab shows, in one call. */
export type ForYou = {
  /** Your own builder profile is set up and visible. */
  visible: boolean;
  requests: ConnectionRequest[];
  suggestions: BuilderCard[];
  /** Other builders' open posts for your trades, near you. */
  helpWanted: HelpPost[];
  /** Your open posts. */
  myPosts: HelpPost[];
  people: BuilderCard[];
};

/** A photo of your own that can go in your work. */
export type MyWorkItem = WorkItem & { shown: boolean };

export type MyBuilderProfile = {
  trades: Trade[];
  about: string;
  travelKm: number;
  /** "Show me to other builders". Off until the builder turns it on. */
  visible: boolean;
  work: MyWorkItem[];
};

export type MyBuilderProfileInput = Omit<MyBuilderProfile, 'work'> & { shownWorkIds: string[] };

export type ReportReason = 'fake' | 'not_their_work' | 'scam' | 'rude' | 'other';

export interface NetworkApi {
  forYou(at?: At): Promise<ForYou>;
  builder(id: string, at?: At): Promise<BuilderProfile>;
  myProfile(): Promise<MyBuilderProfile>;
  saveMyProfile(input: MyBuilderProfileInput): Promise<MyBuilderProfile>;
  connect(builderId: string): Promise<void>;
  accept(requestId: string): Promise<void>;
  ignore(requestId: string): Promise<void>;
  block(builderId: string): Promise<void>;
  report(builderId: string, reason: ReportReason, note: string): Promise<void>;
  createHelpPost(jobId: string, input: NewHelpPost): Promise<HelpPost>;
  helpPost(id: string, at?: At): Promise<HelpPost>;
  interested(postId: string): Promise<HelpPost>;
  pick(postId: string, builderId: string): Promise<HelpPost>;
  closeHelpPost(postId: string): Promise<HelpPost>;
}
