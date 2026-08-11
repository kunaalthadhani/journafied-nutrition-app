// The Track family's UAE launch prices. Every price the app shows reads from
// here, so a price change is one edit and the screens cannot drift apart.
// Nothing here grants anything: entitlements is the only premium truth.

export const PRICES = {
  currency: 'AED',
  kcal: { monthly: 29, annual: 199 },
  trackPlus: { monthly: 44, annual: 299 },
} as const;

export type BillingCycle = 'monthly' | 'annual';
export type Product = 'kcal' | 'trackPlus';

export function priceOf(product: Product, cycle: BillingCycle): number {
  return PRICES[product][cycle];
}

export function formatPrice(amount: number): string {
  return `${PRICES.currency} ${amount}`;
}

// What paying yearly saves against twelve monthly payments.
export function annualSavingPercent(product: Product): number {
  const { monthly, annual } = PRICES[product];
  return Math.round(((monthly * 12 - annual) / (monthly * 12)) * 100);
}

// The chip sits above both products, so it claims the smaller of the two
// savings. Whatever it says is true of either plan.
export const ANNUAL_SAVING_PERCENT = Math.min(
  annualSavingPercent('kcal'),
  annualSavingPercent('trackPlus'),
);

// What the second app actually adds on top of TrackKcal alone. Computed, so
// the "half price" claim on the screen is never a number someone typed.
export function secondAppDelta(cycle: BillingCycle): number {
  return PRICES.trackPlus[cycle] - PRICES.kcal[cycle];
}
