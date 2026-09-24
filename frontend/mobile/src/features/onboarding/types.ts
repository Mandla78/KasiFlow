import type { CipcStatus } from '@/features/auth/types';

export type CipcResult = { status: Exclude<CipcStatus, 'pending'>; registeredName?: string; entityType?: string; checkedAt: string };

export interface OnboardingApi {
  /**
   * The backend's CIPC check, run behind the scenes after the step is
   * saved (never a button the user presses): looks the number up, checks
   * the company is active, and matches the user's name against its
   * directors.
   */
  verifyCipc(number: string, ownerName: string): Promise<CipcResult>;
}
