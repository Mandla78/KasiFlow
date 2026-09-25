/**
 * Jobs on the server (/me/jobs). snake_case on the wire is mapped to the
 * app's camelCase here and nowhere else. api() attaches the token,
 * refreshes it, and turns refusals into ApiError with the server's message.
 *
 * Stage photos go the way the profile photo does: a one-upload signature
 * from our server, the file posted STRAIGHT to Cloudinary, then our server
 * checks it, hashes it and stamps its own time (the phone's clock doesn't
 * count).
 */
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { api, ApiError } from '@/shared/api/client';

import { Job, JobsApi, JobsSummary, Stage } from '../types';

const BASE = '/me/jobs';

type WireStage = {
  id: string;
  name: string;
  amount_cents: number;
  status: Stage['status'];
  photo: { url: string; taken_at: string; sha256: string } | null;
  builder_amount_cents: number | null;
  client_amount_cents: number | null;
  client_note: string | null;
  sign_off_sent_at: string | null;
  confirmed_at: string | null;
};
type WireJob = {
  id: string;
  title: string;
  client_name: string;
  client_phone: string;
  place: string;
  total_cents: number;
  status: Job['status'];
  created_at: string;
  stages: WireStage[];
};

function stage(s: WireStage): Stage {
  return {
    id: s.id,
    name: s.name,
    amountCents: s.amount_cents,
    status: s.status,
    photo: s.photo ? { uri: s.photo.url, takenAt: s.photo.taken_at } : null,
    builderAmountCents: s.builder_amount_cents,
    clientAmountCents: s.client_amount_cents,
    signOffSentAt: s.sign_off_sent_at,
    confirmedAt: s.confirmed_at,
    clientNote: s.client_note,
  };
}

function job(j: WireJob): Job {
  return {
    id: j.id,
    title: j.title,
    clientName: j.client_name,
    clientPhone: j.client_phone,
    place: j.place,
    totalCents: j.total_cents,
    status: j.status,
    createdAt: j.created_at,
    stages: j.stages.map(stage),
  };
}

const path = (jobId: string, stageId?: string) =>
  stageId ? `${BASE}/${encodeURIComponent(jobId)}/stages/${encodeURIComponent(stageId)}` : `${BASE}/${encodeURIComponent(jobId)}`;

export const httpJobsApi: JobsApi = {
  async list() {
    return (await api<{ jobs: WireJob[] }>('GET', BASE, undefined, { auth: true })).jobs.map(job);
  },

  async get(id) {
    return job((await api<{ job: WireJob }>('GET', path(id), undefined, { auth: true })).job);
  },

  async create(input) {
    const body = {
      title: input.title,
      client_name: input.clientName,
      client_phone: input.clientPhone,
      place: input.place,
      total_cents: input.totalCents,
      stages: input.stages.map((s) => ({ name: s.name, amount_cents: s.amountCents })),
    };
    return job((await api<{ job: WireJob }>('POST', BASE, body, { auth: true })).job);
  },

  async addStagePhoto(jobId, stageId, photo) {
    const sig = await api<{ upload_url: string; fields: Record<string, string> }>('POST', `${path(jobId, stageId)}/photo/upload-signature`, undefined, {
      auth: true,
    });
    const form = new FormData();
    Object.entries(sig.fields).forEach(([k, v]) => form.append(k, v));
    if (Platform.OS === 'web') {
      form.append('file', await (await fetch(photo.uri)).blob(), 'stage.jpg');
    } else {
      form.append('file', new File(photo.uri));
    }
    let res: Response;
    try {
      res = await fetch(sig.upload_url, { method: 'POST', body: form });
    } catch {
      throw new ApiError(0, 'UPLOAD_NETWORK', "Couldn't reach the photo service. Check your connection and try again.");
    }
    if (!res.ok) throw new ApiError(res.status, 'UPLOAD_FAILED', "Couldn't upload the photo. Try again.");
    const saved = await api<{ job: WireJob }>('POST', `${path(jobId, stageId)}/photo`, { public_id: sig.fields.public_id }, { auth: true });
    return job(saved.job);
  },

  async sendSignOff(jobId, stageId, builderAmountCents) {
    // The server writes the message itself (with the business name it knows).
    const sent = await api<{ job: WireJob; link: string; message: string }>(
      'POST',
      `${path(jobId, stageId)}/sign-off`,
      { builder_amount_cents: builderAmountCents },
      { auth: true },
    );
    return { job: job(sent.job), link: sent.link, message: sent.message };
  },

  async summary(): Promise<JobsSummary> {
    const s = (await api<{ summary: { active_jobs: number; waiting_on_clients_cents: number; needs_sign_off: number } }>('GET', `${BASE}/summary`, undefined, { auth: true }))
      .summary;
    return { activeJobs: s.active_jobs, waitingOnClientsCents: s.waiting_on_clients_cents, needsSignOff: s.needs_sign_off };
  },
};
