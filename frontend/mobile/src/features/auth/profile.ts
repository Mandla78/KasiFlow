import { BUSINESS_TYPES } from '@/constants/businessTypes';
import { PRIVACY_POLICY } from '@/content/legal/privacyPolicy';
import { TERMS_OF_USE } from '@/content/legal/termsOfUse';

import { Consent, Profile } from './types';

export const emptyProfile: Profile = {
  email: '',
  signedUpWith: 'email',
  dashboard: 'informal-business',
  consent: null,
  businessName: '',
  ownerName: '',
  businessType: null,
  trade: null,
  yearsTrading: null,
  cellphone: '',
  registration: { soleTrader: false, cipc: null },
  location: null,
  deliveryAddress: null,
  categories: [],
  buying: { restock: null, spend: null, payment: null, fulfilment: null },
  supplierIds: [],
  tools: BUSINESS_TYPES.spaza.tools,
};

/** Consent to the CURRENT versions, stamped now. */
export function consentNow(): Consent {
  return {
    privacyVersion: PRIVACY_POLICY.version,
    termsVersion: TERMS_OF_USE.version,
    acceptedAt: new Date().toISOString(),
  };
}

/** What a returning user looks like in the mock (sign in / link Google). */
export function demoProfile(email: string, signedUpWith: Profile['signedUpWith']): Profile {
  return {
    ...emptyProfile,
    email,
    signedUpWith,
    consent: consentNow(),
    businessName: "Nomsa's Spaza",
    ownerName: 'Nomsa Dlamini',
    businessType: 'spaza',
    yearsTrading: '3_plus',
    registration: { ...emptyProfile.registration, soleTrader: true },
    location: {
      building: '',
      street: 'Andrew Mapheto Drive',
      suburb: 'Tembisa',
      city: 'Ekurhuleni',
      province: 'Gauteng',
      postalCode: '1632',
      latitude: -25.9964,
      longitude: 28.2268,
    },
    categories: BUSINESS_TYPES.spaza.categories,
    buying: { restock: 'weekly', spend: '1k_5k', payment: 'both', fulfilment: 'delivery' },
    supplierIds: ['mw', 'dd'],
    tools: BUSINESS_TYPES.spaza.tools,
  };
}

/** The verified badge: only CIPC's word counts (active company, and the user is a director). */
export function isVerified(profile: Profile): boolean {
  return profile.registration.cipc?.status === 'verified';
}

/** Short area name for headers ("Tembisa"), from the confirmed location. */
export function areaOf(profile: Profile): string {
  return profile.location?.suburb || profile.location?.city || '';
}
