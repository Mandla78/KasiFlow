/**
 * The REAL onboarding API. The CIPC check runs on the server when the
 * registration is saved; the answer comes back with the saved profile.
 */
import { ApiError } from '@/shared/api/client';

import { OnboardingApi } from '../types';
import { businessProfileApi, toServer } from './businessProfileApi';

export const httpOnboardingApi: OnboardingApi = {
  async verifyCipc(number, profile) {
    const checkedAt = new Date().toISOString();
    try {
      const sections = toServer(profile);
      const saved = await businessProfileApi.save({
        business: sections.business,
        registration: { sole_trader: false, cipc_number: number },
      });
      const cipc = saved.registration.cipc;
      if (!cipc || cipc.status === 'pending') return { status: 'unavailable', checkedAt };
      return {
        status: cipc.status,
        registeredName: cipc.registered_name ?? undefined,
        entityType: cipc.entity_type ?? undefined,
        checkedAt: cipc.checked_at ?? checkedAt,
      };
    } catch (e) {
      if (e instanceof ApiError) return { status: 'unavailable', checkedAt };
      throw e;
    }
  },
};
