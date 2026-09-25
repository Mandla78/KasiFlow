import { BusinessType, ToolKey, TradeKey } from '@/constants/businessTypes';
import { CategoryCode } from '@/constants/categories';
import type { PickedPlace } from '@/shared/location-picker/types';

/** A place the trader confirmed (see PickedPlace). */
export type Place = PickedPlace;

export type { BusinessType, ToolKey, TradeKey };

/**
 * Which dashboard the account opens. Only informal businesses sign up in
 * the app today; suppliers come in through the backend integration, and a
 * formal-business dashboard can be added beside these later.
 */
export type Dashboard = 'informal-business' | 'supplier';

export type YearsTrading = 'under_1' | '1_3' | '3_plus';

/**
 * Outcome of the backend's CIPC check. The register is public, so a number
 * that exists proves the COMPANY exists, not that this user is it: only a
 * director-name match earns 'verified'.
 */
export type CipcStatus =
  | 'pending' // submitted, the backend hasn't checked yet
  | 'verified' // active company, and the user is one of its directors
  | 'owner_unconfirmed' // active company, but no director matches the user
  | 'deregistered'
  | 'not_found'
  | 'unavailable'; // CIPC unreachable: the backend retries

export type Registration = {
  soleTrader: boolean;
  cipc: { number: string; status: CipcStatus; registeredName?: string; checkedAt?: string } | null;
};

export type Buying = {
  restock: 'daily' | 'weekly' | 'fortnightly' | 'monthly' | null;
  spend: 'under_1k' | '1k_5k' | '5k_20k' | 'over_20k' | null;
  payment: 'payfast' | 'cash' | 'both' | null;
  fulfilment: 'delivery' | 'collect' | 'either' | null;
};

export type Consent = { privacyVersion: string; termsVersion: string; acceptedAt: string };

export type Profile = {
  email: string;
  signedUpWith: 'email' | 'google';
  dashboard: Dashboard;
  consent: Consent | null;

  // Business
  businessName: string;
  ownerName: string;
  businessType: BusinessType | null;
  trade: TradeKey | null;
  yearsTrading: YearsTrading | null;
  cellphone: string;
  registration: Registration;

  // Location
  location: Place | null;
  /** null = deliver to the business location. */
  deliveryAddress: Place | null;

  // Buying (feeds the supplier engine)
  categories: CategoryCode[];
  buying: Buying;
  supplierIds: string[];
  /** The approved profile photo (Cloudinary), if any. */
  profileImageUrl?: string | null;

  tools: Record<ToolKey, boolean>;
};

export class AuthError extends Error {
  constructor(
    /** The server's stable code, e.g. INVALID_CODE, WEAK_PASSWORD, RATE_LIMITED, NETWORK. */
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Sign-in is two-factor: the password, plus either a trusted phone or a
 * code sent to the email. On a new phone the first step returns a
 * challenge; the code screen finishes with verifySignIn.
 */
export type SignInResult = { kind: 'signed_in'; profile: Profile } | { kind: 'code_required'; challenge: string };

/** Everything the auth screens ask of the server. Mock today, HTTP later. */
export interface AuthApi {
  createAccount(input: { email: string; password: string; consent: Consent }): Promise<void>;
  verifyEmail(email: string, code: string): Promise<void>;
  resendCode(email: string): Promise<void>;
  /** 'new' starts onboarding; 'link' means a password account already uses the email. */
  continueWithGoogle(email: string): Promise<'new' | 'link'>;
  linkGoogle(email: string, password: string): Promise<Profile>;
  signIn(email: string, password: string): Promise<SignInResult>;
  /** Second step on a new phone: the code from the email. This phone is trusted afterwards. */
  verifySignIn(email: string, challenge: string, code: string): Promise<Profile>;
  resendSignInCode(challenge: string): Promise<void>;
  /** Same answer whether or not the account exists, so nobody can fish for emails. */
  requestPasswordReset(email: string): Promise<void>;
  /** From the reset link: set a new password. */
  resetPassword(token: string, password: string): Promise<void>;
  /** End this phone's session on the server. */
  logout(): Promise<void>;
}
