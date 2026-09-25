/**
 * The trader's business profile on the server (/me/business-profile).
 *
 * The app keeps the profile in the session for instant screens; this is
 * where it is saved and read back. The server owns the CIPC result: the
 * app only ever sends the registration NUMBER.
 */
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { api, ApiError } from '@/shared/api/client';

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
  profile_image_url: string | null;
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
    profileImageUrl: s.profile_image_url,
  };
}

export const businessProfileApi = {
  async get(): Promise<ServerProfile | null> {
    return (await api<{ profile: ServerProfile | null }>('GET', '/me/business-profile', undefined, { auth: true })).profile;
  },
  async save(sections: Partial<Record<Section, unknown>>): Promise<ServerProfile> {
    return (await api<{ profile: ServerProfile }>('PATCH', '/me/business-profile', sections, { auth: true })).profile;
  },

  /**
   * Profile photo: ask our server for a one-upload signature, post the
   * file STRAIGHT to Cloudinary (our server never carries the bytes),
   * then tell our server, which checks the upload with Cloudinary itself.
   */
  async uploadProfileImage(uri: string): Promise<ServerProfile> {
    const sig = await api<{ upload_url: string; fields: Record<string, string> }>(
      'POST',
      '/me/business-profile/image/upload-signature',
      undefined,
      { auth: true },
    );
    const form = new FormData();
    Object.entries(sig.fields).forEach(([k, v]) => form.append(k, v));
    if (Platform.OS === 'web') {
      form.append('file', await (await fetch(uri)).blob(), 'photo.jpg');
    } else {
      // Expo's fetch needs a real file object (the old React Native
      // { uri, name, type } trick fails with "Unsupported FormDataPart").
      form.append('file', new File(uri));
    }
    let res: Response;
    try {
      res = await fetch(sig.upload_url, { method: 'POST', body: form });
    } catch (e) {
      // The phone couldn't reach Cloudinary at all. In development, say why.
      const why = __DEV__ && e instanceof Error ? ` (${e.message})` : '';
      throw new ApiError(0, 'UPLOAD_NETWORK', `Couldn't reach the photo service. Check your connection and try again.${why}`);
    }
    if (!res.ok) {
      // Cloudinary refused the file; its reason is safe to show in development.
      let why = '';
      if (__DEV__) {
        try {
          why = ` (${res.status}: ${((await res.json()) as { error?: { message?: string } }).error?.message ?? ''})`;
        } catch {
          why = ` (${res.status})`;
        }
      }
      throw new ApiError(res.status, 'UPLOAD_FAILED', `Couldn't upload the photo. Try another photo.${why}`);
    }
    return (await api<{ profile: ServerProfile }>('POST', '/me/business-profile/image', { public_id: sig.fields.public_id }, { auth: true }))
      .profile;
  },

  async removeProfileImage(): Promise<ServerProfile | null> {
    return (await api<{ profile: ServerProfile | null }>('DELETE', '/me/business-profile/image', undefined, { auth: true })).profile;
  },
};
