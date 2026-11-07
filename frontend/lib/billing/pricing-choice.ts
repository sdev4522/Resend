/**
 * Remembers the plan + billing term a visitor picked on the pricing section, so the
 * choice survives signup/email verification and is preselected in onboarding / checkout.
 * Stored in sessionStorage only (per tab, cleared when the tab closes).
 */
export type PricingChoice = { planId: number; durationMonths: 1 | 12 };

const KEY = 'resend_pricing_choice';

export function savePricingChoice(choice: PricingChoice) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(choice));
  } catch {
    // storage unavailable (private mode): the user just picks again later
  }
}

export function readPricingChoice(): PricingChoice | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const planId = Number(parsed?.planId);
    const durationMonths = Number(parsed?.durationMonths) === 12 ? 12 : 1;
    return Number.isInteger(planId) && planId > 0 ? { planId, durationMonths } : null;
  } catch {
    return null;
  }
}

export function clearPricingChoice() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Query string for /dashboard/billing so a logged-in user lands on the chosen plan and term. */
export function billingCheckoutHref(choice: PricingChoice) {
  return `/dashboard/billing?plan=${choice.planId}&months=${choice.durationMonths}`;
}
