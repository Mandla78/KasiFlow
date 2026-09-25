/**
 * The rules of a job's stages, with no screens attached: the starter list,
 * "the stages add up to the total", what counts as paid and confirmed, the
 * match rule, and the words the builder and the client see. The server
 * keeps the same rules (CONTRACT_jobs.txt).
 */
import { Cents, formatRand } from '@/shared/lib/money';

import { ClientAnswer, Job, Stage, StageStatus } from '../types';

/** The stages most builds go through; the builder renames, adds, removes. */
export const STARTER_STAGES = ['Deposit', 'Foundation', 'Walls', 'Roof', 'Final'];

/** R5,000,000: a whole house, with room; a slipped finger is caught. */
export const MAX_JOB_CENTS: Cents = 500_000_000;
export const MAX_STAGES = 12;
export const TITLE_MAX = 60;
export const CLIENT_NAME_MAX = 60;
export const PLACE_MAX = 120;
export const STAGE_NAME_MAX = 40;
export const NOTE_MAX = 200;

export function stagesTotal(stages: { amountCents: Cents }[]): Cents {
  return stages.reduce((sum, s) => sum + s.amountCents, 0);
}

/** How the stage amounts compare to the job total, in words for the form. */
export function difference(totalCents: Cents, stagesCents: Cents): { text: string; ok: boolean } {
  const diff = totalCents - stagesCents;
  if (diff === 0) return { text: 'The stages add up to the total.', ok: true };
  if (diff > 0) return { text: `${formatRand(diff)} still to share out between the stages.`, ok: false };
  return { text: `The stages are ${formatRand(-diff)} more than the total.`, ok: false };
}

/** Cash both sides agreed was paid: the confirmed stages only. */
export function confirmedCents(job: Job): Cents {
  return job.stages.reduce((sum, s) => (s.status === 'confirmed' ? sum + (s.builderAmountCents ?? 0) : sum), 0);
}

/** The stage to work on next: the first one not confirmed. */
export function currentStage(job: Job): Stage | null {
  return job.stages.find((s) => s.status !== 'confirmed') ?? null;
}

/** The match rule: the same amount is "confirmed by both", anything else a dispute. */
export function decide(builderCents: Cents, answer: ClientAnswer): StageStatus {
  if (answer.kind === 'not_yet') return 'photo_taken';
  return answer.amountCents === builderCents ? 'confirmed' : 'amounts_dont_match';
}

export type Tone = 'jade' | 'marigold' | 'garnet' | 'muted';

export function statusLabel(stage: Stage): { text: string; tone: Tone } {
  switch (stage.status) {
    case 'not_started':
      return { text: 'Not started', tone: 'muted' };
    case 'photo_taken':
      return { text: stage.clientNote ? 'Client said not yet' : 'Photo taken · send sign-off', tone: 'marigold' };
    case 'waiting':
      return { text: stage.photo ? 'Photo taken · waiting for client' : 'Waiting for client', tone: 'marigold' };
    case 'confirmed':
      return { text: 'Confirmed by both', tone: 'jade' };
    case 'amounts_dont_match':
      return { text: "Amounts don't match", tone: 'garnet' };
  }
}

/**
 * The WhatsApp message with the sign-off link, sent by the builder from
 * their own phone. No amount in it: the client types their own.
 */
export function signOffMessage(job: Job, stage: Stage, businessName: string, link: string): string {
  const what = job.title.trim().toLowerCase();
  return `Hi ${job.clientName.trim()}, ${businessName} asks you to sign off the ${stage.name} stage of the ${what}. Please confirm here, no app needed: ${link} Thank you!`;
}
