/**
 * Jobs, as the app sees them (docs/teammate/07_JOBS_PLAN.txt). A builder is
 * paid in stages, in cash; each stage becomes a photo plus a sign-off the
 * CLIENT gives from a link, with no app. Field names are the camelCase
 * twins of the proposed API (docs/teammate/feedback/CONTRACT_jobs.txt).
 *
 * Money is integer cents. Dates are ISO strings.
 */
import { Cents } from '@/shared/lib/money';

export type JobStatus = 'active' | 'done';

/**
 * not_started        nothing yet
 * photo_taken        the builder took the stage photo
 * waiting            the sign-off link went to the client
 * confirmed          the client typed the same cash amount as the builder
 * amounts_dont_match the amounts differ: a dispute, both numbers kept
 */
export type StageStatus = 'not_started' | 'photo_taken' | 'waiting' | 'confirmed' | 'amounts_dont_match';

export type StagePhoto = {
  /** On the phone until the backend exists; then the Cloudinary URL. */
  uri: string;
  /** When it was taken. The server stamps its own time on upload. */
  takenAt: string;
};

export type Stage = {
  id: string;
  name: string;
  amountCents: Cents;
  status: StageStatus;
  photo: StagePhoto | null;
  /** What the builder says they received for this stage. */
  builderAmountCents: Cents | null;
  /** What the client says they paid. Only shown once both are in. */
  clientAmountCents: Cents | null;
  signOffSentAt: string | null;
  confirmedAt: string | null;
  /** The client's "Not yet" reason, until the next sign-off. */
  clientNote: string | null;
};

export type Job = {
  id: string;
  /** What the job is: "Room extension". */
  title: string;
  clientName: string;
  /** 0XXXXXXXXX: where the sign-off link goes, from the builder's WhatsApp. */
  clientPhone: string;
  /** Where the job is: short text. */
  place: string;
  totalCents: Cents;
  status: JobStatus;
  stages: Stage[];
  createdAt: string;
};

export type NewJob = {
  title: string;
  clientName: string;
  clientPhone: string;
  place: string;
  totalCents: Cents;
  stages: { name: string; amountCents: Cents }[];
};

/** What sending a sign-off gives back: the updated job, and the WhatsApp message with the link. */
export type SignOffSent = { job: Job; link: string; message: string };

/** The client's answer on the sign-off page. */
export type ClientAnswer = { kind: 'done'; amountCents: Cents } | { kind: 'not_yet'; note: string };

/** For Home and the Account tile. */
export type JobsSummary = {
  activeJobs: number;
  /** Stage amounts the builder is still waiting to have confirmed. */
  waitingOnClientsCents: Cents;
  needsSignOff: number;
};

export interface JobsApi {
  list(): Promise<Job[]>;
  get(id: string): Promise<Job>;
  create(input: NewJob): Promise<Job>;
  /** The stage photo, taken with the camera (never the gallery). */
  addStagePhoto(jobId: string, stageId: string, photo: StagePhoto): Promise<Job>;
  /** The builder's cash amount for the stage; returns the link to send to the client. */
  sendSignOff(jobId: string, stageId: string, builderAmountCents: Cents, businessName: string): Promise<SignOffSent>;
  summary(): Promise<JobsSummary>;
}
