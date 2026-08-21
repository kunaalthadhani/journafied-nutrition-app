import { Platform } from 'react-native';
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';

// The purchase pipe, the mirror of TrackLifts' src/purchases.ts. RevenueCat
// owns the store conversation and the app only asks two things: what can I
// sell, and what did this person buy. The public key ships in the APK by
// design, the secret never leaves the dashboard.
//
// Loaded lazily and guarded on every call: Expo Go and the PWA have no native
// module, and neither may crash for that. purchasesReady() is false there and
// every function returns a polite nothing.

// Public Google API key for the TrackKcal app in the shared RevenueCat project.
// Public by design: it ships in the APK and can only read offerings and start
// a purchase. The secret key never leaves the dashboard.
const GOOGLE_KEY = 'goog_PJXVwVCaxvHhotKLBoiDdaJdgUi';

// Package identifiers exactly as created in the RevenueCat default offering.
// Same names as Lifts so the two clients read the same shape.
const PACKAGE_KEY = {
  kcal: { monthly: '$rc_monthly', annual: '$rc_annual' },
  plus: { monthly: 'plus_monthly', annual: 'plus_annual' },
} as const;

export type Tier = keyof typeof PACKAGE_KEY;
export type Billing = 'monthly' | 'annual';

/** What RevenueCat says this person owns. trackPlus is the family entitlement. */
export interface Grants {
  kcalPremium: boolean;
  trackPlus: boolean;
}

export const NO_GRANTS: Grants = { kcalPremium: false, trackPlus: false };

type RC = typeof import('react-native-purchases').default;

let rc: RC | null = null;

export const purchasesReady = (): boolean => rc != null;

/**
 * Runs once at boot, before anything can sell. appUserID is the Supabase user
 * id, which is what makes a purchase land on the family account and makes
 * Track Plus bought in TrackLifts visible here with no server code at all.
 */
export const configurePurchases = (userId: string | null): void => {
  if (Platform.OS !== 'android') return;
  if (!GOOGLE_KEY) return; // not configured yet, stay inert rather than throw
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    rc = (require('react-native-purchases') as { default: RC }).default;
    rc.configure({ apiKey: GOOGLE_KEY, appUserID: userId ?? undefined });
  } catch {
    rc = null;
  }
};

/** Sign in and sign out keep RevenueCat pointed at the same person. */
export const syncPurchaseIdentity = async (userId: string | null): Promise<void> => {
  if (!rc) return;
  try {
    if (userId) await rc.logIn(userId);
    else await rc.logOut();
  } catch {
    // identity resyncs on next boot
  }
};

export const grantsOf = (info: CustomerInfo): Grants => ({
  kcalPremium: 'kcalPremium' in info.entitlements.active,
  trackPlus: 'trackPlus' in info.entitlements.active,
});

export const fetchGrants = async (): Promise<Grants | null> => {
  if (!rc) return null;
  try {
    return grantsOf(await rc.getCustomerInfo());
  } catch {
    return null;
  }
};

const packageFor = async (tier: Tier, billing: Billing): Promise<PurchasesPackage | null> => {
  if (!rc) return null;
  const offerings = await rc.getOfferings();
  const pkgs = offerings.current?.availablePackages ?? [];
  return pkgs.find(p => p.identifier === PACKAGE_KEY[tier][billing]) ?? null;
};

export type BuyResult =
  | { ok: true; grants: Grants }
  | { ok: false; cancelled: boolean; message: string };

export const buy = async (tier: Tier, billing: Billing): Promise<BuyResult> => {
  if (!rc) return { ok: false, cancelled: false, message: 'Buying arrives with the store release.' };
  try {
    const pkg = await packageFor(tier, billing);
    if (!pkg) {
      return { ok: false, cancelled: false, message: 'The store has no products yet. Try again after the next update.' };
    }
    const { customerInfo } = await rc.purchasePackage(pkg);
    return { ok: true, grants: grantsOf(customerInfo) };
  } catch (e) {
    const err = e as { userCancelled?: boolean; message?: string };
    return {
      ok: false,
      cancelled: err.userCancelled === true,
      message: err.message ?? 'The purchase did not go through. Nothing was charged.',
    };
  }
};

export const restore = async (): Promise<BuyResult> => {
  if (!rc) return { ok: false, cancelled: false, message: 'Buying arrives with the store release.' };
  try {
    return { ok: true, grants: grantsOf(await rc.restorePurchases()) };
  } catch (e) {
    const err = e as { message?: string };
    return { ok: false, cancelled: false, message: err.message ?? 'Nothing to restore on this account.' };
  }
};
