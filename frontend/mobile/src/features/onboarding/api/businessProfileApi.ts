/**
 * The trader's business profile on the server (/me/business-profile).
 *
 * The app keeps the profile in the session for instant screens; this is
 * where it is saved and read back. The server owns the CIPC result: the
 * app only ever sends the registration NUMBER.
 */
import { api } from '@/shared/api/client';

import type { CipcStatus, Profile } from '@/features/auth/types';

type ServerCipc = { number: string; status: CipcStatus; registered_name: string | null; entity_type: string | null; checked_at: string | null };

export type ServerProfile = {
  business: { business_type: Profile['businessType']; trade: Profile['trade']; owner_name: string | null; years_trading: Profile['yearsTrading']; cellphone: string | null };
  registration: { sole_trader: boolean; cipc: ServerCipc | null };
  location: {
    building: string;
    street: string;
    suburb: string;
    city: string;
    province: string;
    postal_code: string;
    latitude: number;
    longitude: number;
  } | null;
  buying: { categories: Profile['categories'] } & Profile['buying'];
  tools: Profile['tools'];
  verified: boolean;
  onboarded: boolean;
};

export type Section = 'business' | 'registration' | 'location' | 'buying' | 'tools';

/** The profile as the server's PATCH expects it, section by section. */
export function toServer(p: Profile): Record<Section, unknown> {
  const l = p.location;
  return {
    business: {
      business_type: p.businessType,
      trade: p.businessType === 'builder' ? p.trade : null,
      owner_name: p.ownerName.trim().length >= 2 ? p.ownerName.trim() : null,
      years_trading: p.yearsTrading,
      cellphone: p.cellphone.replace(/\D/g, '') || null,
    },
    registration: { sole_trader: p.registration.soleTrader, cipc_number: p.registration.cipc?.number ?? null },
    location: l
      ? {
          building: l.building,
          street: l.street,
          suburb: l.suburb,
          city: l.city,
          province: l.province,
          postal_code: /^\d{4}$/.test(l.postalCode) ? l.postalCode : '',
          latitude: l.latitude,
          longitude: l.longitude,
        }
      : null,
    buying: { categories: p.categories, ...p.buying },
    tools: p.tools,
  };
}

/** The server's answers, in the app's shape. */
export function fromServer(s: ServerProfile): Partial<Profile> {
  const c = s.registration.cipc;
  return {
    businessType: s.business.business_type,
    trade: s.business.trade,
    ownerName: s.business.owner_name ?? '',
    yearsTrading: s.business.years_trading,
    cellphone: s.business.cellphone ?? '',
    registration: {
      soleTrader: s.registration.sole_trader,
      cipc: c
        ? { number: c.number, status: c.status ?? 'pending', registeredName: c.registered_name ?? undefined, checkedAt: c.checked_at ?? undefined }
        : null,
    },
    location: s.location
      ? {
          building: s.location.building,
          street: s.location.street,
          suburb: s.location.suburb,
          city: s.location.city,
          province: s.location.province,
          postalCode: s.location.postal_code,
          latitude: s.location.latitude,
          longitude: s.location.longitude,
        }
      : null,
    categories: s.buying.categories,
    buying: { restock: s.buying.restock, spend: s.buying.spend, payment: s.buying.payment, fulfilment: s.buying.fulfilment },
    tools: { ...s.tools },
  };
}

export const businessProfileApi = {
  async get(): Promise<ServerProfile | null> {
    return (await api<{ profile: ServerProfile | null }>('GET', '/me/business-profile', undefined, { auth: true })).profile;
  },
  async save(sections: Partial<Record<Section, unknown>>): Promise<ServerProfile> {
    return (await api<{ profile: ServerProfile }>('PATCH', '/me/business-profile', sections, { auth: true })).profile;
  },
};
