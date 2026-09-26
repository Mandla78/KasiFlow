/**
 * MOCK jobs: every screen works before the backend exists. Kept on the
 * phone (secure storage) so jobs survive a restart; memory only in the web
 * preview. It keeps the plan's rules and throws the server's kind of errors
 * (CONTRACT_jobs.txt), so switching to an httpJobsApi changes no screen.
 *
 * The client's side of a sign-off is a web page on the backend. Until it
 * exists, answerPractice() plays the client from the app's practice page
 * (marked "Test"), like the payment cards' practice page.
 */
import * as SecureStore from 'expo-secure-store';

import { normalisePhone } from '@/features/dashboard/informal-business/credit-book/lib/whatsapp';
import { ApiError } from '@/shared/api/client';
import { Cents } from '@/shared/lib/money';

import {
  CLIENT_NAME_MAX,
  decide,
  MAX_JOB_CENTS,
  MAX_STAGES,
  NOTE_MAX,
  PLACE_MAX,
  signOffMessage,
  STAGE_NAME_MAX,
  stagesTotal,
  TITLE_MAX,
} from '../lib/stages';
import { BIN_DAYS } from '@/features/dashboard/informal-business/credit-book/types';

import { ClientAnswer, Job, JobsApi, Stage } from '../types';

const KEY = 'akayza.mock-jobs.v1';
const wait = (ms = 400) => new Promise((r) => setTimeout(r, ms));
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

let jobs: Job[] | null = null;

function invalid(field: string, message: string): never {
  throw new ApiError(422, 'VALIDATION_ERROR', message, { errors: { [field]: [message] } });
}

function notFound(): never {
  throw new ApiError(404, 'NOT_FOUND', "We couldn't find that job.");
}

function stage(name: string, amountCents: Cents, extra: Partial<Stage> = {}): Stage {
  return {
    id: newId('stg'),
    name,
    amountCents,
    status: 'not_started',
    photo: null,
    builderAmountCents: null,
    clientAmountCents: null,
    signOffSentAt: null,
    confirmedAt: null,
    clientNote: null,
    ...extra,
  };
}

/** The design's job (PDF p12): deposit confirmed, walls waiting for the client. */
function sample(): Job[] {
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();
  return [
    {
      id: 'job-mokoena',
      title: 'Room extension',
      clientName: 'Mokoena family',
      clientPhone: '0821234567',
      place: 'Tembisa, Ext 5',
      totalCents: 3_800_000,
      status: 'active',
      createdAt: daysAgo(20),
      binnedAt: null,
      stages: [
        stage('Deposit', 500_000, { status: 'confirmed', builderAmountCents: 500_000, clientAmountCents: 500_000, signOffSentAt: daysAgo(19), confirmedAt: daysAgo(19) }),
        stage('Walls', 1_200_000, { status: 'waiting', builderAmountCents: 1_200_000, signOffSentAt: daysAgo(1) }),
        stage('Roof', 1_200_000),
        stage('Final', 900_000),
      ],
    },
  ];
}

async function load(): Promise<Job[]> {
  if (jobs) return jobs;
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    jobs = raw ? (JSON.parse(raw) as Job[]) : sample();
  } catch {
    jobs = sample(); // web preview: memory only
  }
  return jobs;
}

async function save(next: Job[]) {
  jobs = next;
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(next));
  } catch {
    // web preview
  }
}

const shown = (j: Job) => !j.binnedAt;

/** Still in the bin's view: deleted in the last BIN_DAYS days. */
const inBin = (j: Job) => !!j.binnedAt && Date.now() - Date.parse(j.binnedAt) < BIN_DAYS * 86_400_000;

/** When the job last moved on: its latest confirmation, or when it was made. */
const lastActivity = (j: Job) => j.stages.reduce((latest, s) => (s.confirmedAt && s.confirmedAt > latest ? s.confirmedAt : latest), j.createdAt);

/** A job the builder can see; binned ones are "not found" like the server's. */
function find(all: Job[], id: string): Job {
  return all.find((j) => j.id === id && shown(j)) ?? notFound();
}

function findStage(job: Job, stageId: string): Stage {
  return job.stages.find((s) => s.id === stageId) ?? notFound();
}

function text(value: string, field: string, max: number, required = true): string {
  const v = value.trim().replace(/\s+/g, ' ');
  if (required && !/\p{L}/u.test(v)) invalid(field, 'Use at least one letter.');
  if (v.length > max) invalid(field, `Use at most ${max} characters.`);
  return v;
}

function cents(value: Cents, field: string, min = 1): Cents {
  if (!Number.isInteger(value) || value < min || value > MAX_JOB_CENTS) invalid(field, 'Enter an amount up to R5,000,000.');
  return value;
}

const copy = (job: Job): Job => JSON.parse(JSON.stringify(job)) as Job;

export const mockJobsApi: JobsApi = {
  async list() {
    await wait();
    const all = await load();
    // Active first (newest first), then done.
    return all.filter(shown).sort((a, b) => (a.status === b.status ? b.createdAt.localeCompare(a.createdAt) : a.status === 'active' ? -1 : 1)).map(copy);
  },

  async get(id) {
    await wait(250);
    return copy(find(await load(), id));
  },

  async create(input) {
    await wait();
    const all = await load();
    const title = text(input.title, 'title', TITLE_MAX);
    const clientName = text(input.clientName, 'client_name', CLIENT_NAME_MAX);
    const clientPhone = normalisePhone(input.clientPhone) ?? invalid('client_phone', 'A cellphone number, like 082 123 4567.');
    const place = text(input.place, 'place', PLACE_MAX, false);
    const total = cents(input.totalCents, 'total_cents');
    if (input.stages.length < 1 || input.stages.length > MAX_STAGES) invalid('stages', `Add 1 to ${MAX_STAGES} stages.`);
    const stages = input.stages.map((s) => stage(text(s.name, 'stages', STAGE_NAME_MAX), cents(s.amountCents, 'stages')));
    if (stagesTotal(stages) !== total) invalid('stages', 'The stages must add up to the total.');
    const job: Job = { id: newId('job'), title, clientName, clientPhone, place, totalCents: total, status: 'active', stages, createdAt: new Date().toISOString(), binnedAt: null };
    await save([job, ...all]);
    return copy(job);
  },

  async addStagePhoto(jobId, stageId, photo) {
    await wait();
    const all = await load();
    const job = find(all, jobId);
    const s = findStage(job, stageId);
    if (s.status === 'confirmed') throw new ApiError(409, 'STAGE_CONFIRMED', 'This stage is already confirmed by both of you.');
    s.photo = { uri: photo.uri, takenAt: new Date().toISOString() };
    if (s.status === 'not_started') s.status = 'photo_taken';
    await save(all);
    return copy(job);
  },

  async sendSignOff(jobId, stageId, builderAmountCents, businessName) {
    await wait();
    const all = await load();
    const job = find(all, jobId);
    const s = findStage(job, stageId);
    if (s.status === 'confirmed') throw new ApiError(409, 'STAGE_CONFIRMED', 'This stage is already confirmed by both of you.');
    s.builderAmountCents = cents(builderAmountCents, 'builder_amount_cents', 0);
    s.clientAmountCents = null;
    s.clientNote = null;
    s.status = 'waiting';
    s.signOffSentAt = new Date().toISOString();
    await save(all);
    // .test never resolves: a test link, clearly not a real one.
    const link = `https://akayza.test/sign-off?ticket=${Math.random().toString(36).slice(2, 12)}`;
    return { job: copy(job), link, message: signOffMessage(job, s, businessName, link) };
  },

  async summary() {
    await wait(250);
    const all = await load();
    const active = all.filter((j) => j.status === 'active' && shown(j));
    const stages = active.flatMap((j) => j.stages);
    return {
      activeJobs: active.length,
      waitingOnClientsCents: stages.filter((s) => s.status === 'waiting').reduce((sum, s) => sum + s.amountCents, 0),
      needsSignOff: stages.filter((s) => s.status === 'photo_taken' || s.status === 'amounts_dont_match').length,
    };
  },

  async history(query) {
    await wait(300);
    const q = query.trim().toLowerCase();
    return (await load())
      .filter((j) => shown(j) && j.status === 'done')
      .filter((j) => !q || j.title.toLowerCase().includes(q) || j.clientName.toLowerCase().includes(q))
      .sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)))
      .map(copy);
  },

  async bin() {
    await wait(300);
    return (await load())
      .filter(inBin)
      .sort((a, b) => (b.binnedAt ?? '').localeCompare(a.binnedAt ?? ''))
      .map(copy);
  },

  async moveToBin(id) {
    await wait();
    const all = await load();
    const job = find(all, id);
    job.binnedAt = new Date().toISOString();
    // Like the server: links the client hasn't answered stop working, so nothing waits on them.
    for (const s of job.stages) if (s.status === 'waiting') s.status = s.photo ? 'photo_taken' : 'not_started';
    await save(all);
  },

  async restore(id) {
    await wait();
    const all = await load();
    const job = all.find((j) => j.id === id && inBin(j)) ?? notFound();
    job.binnedAt = null;
    await save(all);
    return copy(job);
  },
};

/**
 * PRACTICE ONLY: the client's answer, as the sign-off web page will give
 * it. The client types their OWN amount; it never shows the builder's.
 */
export async function answerPractice(jobId: string, stageId: string, answer: ClientAnswer): Promise<Job> {
  await wait(600);
  const all = await load();
  const job = find(all, jobId);
  const s = findStage(job, stageId);
  if (s.status !== 'waiting') throw new ApiError(410, 'LINK_USED', 'This link has already been used or has expired.');
  if (answer.kind === 'done') {
    s.clientAmountCents = cents(answer.amountCents, 'amount_cents', 0);
  } else {
    s.clientNote = text(answer.note, 'note', NOTE_MAX, false) || 'Not done yet';
  }
  s.status = decide(s.builderAmountCents ?? 0, answer);
  if (s.status === 'confirmed') s.confirmedAt = new Date().toISOString();
  if (job.stages.every((x) => x.status === 'confirmed')) job.status = 'done';
  await save(all);
  return copy(job);
}
