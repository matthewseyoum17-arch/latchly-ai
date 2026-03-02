import Stripe from "stripe";

export type BillingPlan = "solo" | "team" | "multi";
export type BillingCycle = "monthly" | "annual";

type PriceConfig = Record<BillingPlan, Record<BillingCycle, string | undefined>>;

const PRICE_IDS: PriceConfig = {
  solo: {
    monthly: process.env.STRIPE_PRICE_SOLO_MONTHLY,
    annual: process.env.STRIPE_PRICE_SOLO_ANNUAL,
  },
  team: {
    monthly: process.env.STRIPE_PRICE_TEAM_MONTHLY,
    annual: process.env.STRIPE_PRICE_TEAM_ANNUAL,
  },
  multi: {
    monthly: process.env.STRIPE_PRICE_MULTI_MONTHLY,
    annual: process.env.STRIPE_PRICE_MULTI_ANNUAL,
  },
};

const PRICE_TO_PLAN = new Map<string, { plan: BillingPlan; billingCycle: BillingCycle }>();

for (const [plan, cycles] of Object.entries(PRICE_IDS) as [BillingPlan, Record<BillingCycle, string | undefined>][]) {
  for (const [billingCycle, priceId] of Object.entries(cycles) as [BillingCycle, string | undefined][]) {
    if (priceId) {
      PRICE_TO_PLAN.set(priceId, { plan, billingCycle });
    }
  }
}

let stripeClient: Stripe | null = null;

export function isBillingPlan(value: unknown): value is BillingPlan {
  return value === "solo" || value === "team" || value === "multi";
}

export function isBillingCycle(value: unknown): value is BillingCycle {
  return value === "monthly" || value === "annual";
}

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY environment variable.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      httpClient: Stripe.createNodeHttpClient(),
    });
  }

  return stripeClient;
}

export function getPriceId(plan: BillingPlan, billingCycle: BillingCycle) {
  const priceId = PRICE_IDS[plan]?.[billingCycle];
  if (!priceId) {
    throw new Error(`Missing Stripe price ID for ${plan} (${billingCycle}).`);
  }
  return priceId;
}

export function getSetupFeePriceId() {
  const priceId = process.env.STRIPE_PRICE_SETUP_FEE;
  if (!priceId) {
    throw new Error("Missing STRIPE_PRICE_SETUP_FEE environment variable.");
  }
  return priceId;
}

export function resolvePlanFromPriceId(priceId?: string | null) {
  if (!priceId) return null;
  return PRICE_TO_PLAN.get(priceId) || null;
}

export function getAppUrl(fallbackOrigin?: string) {
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || fallbackOrigin;
  if (!appUrl) {
    throw new Error("Missing APP_URL environment variable.");
  }

  return appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;
}
