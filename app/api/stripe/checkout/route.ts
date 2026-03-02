import { NextRequest, NextResponse } from "next/server";
import {
  BillingCycle,
  BillingPlan,
  getAppUrl,
  getPriceId,
  getSetupFeePriceId,
  getStripe,
  isBillingCycle,
  isBillingPlan,
} from "@/lib/stripe";

export const runtime = "nodejs";

const TRIAL_DAYS = 14;

interface CheckoutBody {
  plan?: unknown;
  billingCycle?: unknown;
  customerEmail?: unknown;
  trial?: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CheckoutBody;
    const plan = body.plan;
    const billingCycle = body.billingCycle ?? "monthly";
    const withTrial = body.trial === true;

    if (!isBillingPlan(plan)) {
      return NextResponse.json({ error: "Invalid plan selected." }, { status: 400 });
    }

    if (!isBillingCycle(billingCycle)) {
      return NextResponse.json({ error: "Invalid billing cycle selected." }, { status: 400 });
    }

    const recurringPriceId = getPriceId(plan as BillingPlan, billingCycle as BillingCycle);
    const setupFeePriceId = getSetupFeePriceId();
    const customerEmail = typeof body.customerEmail === "string" ? body.customerEmail : undefined;

    const stripe = getStripe();
    const appUrl = getAppUrl(request.nextUrl.origin);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        { price: recurringPriceId, quantity: 1 },
        // For non-trial: charge setup fee immediately at checkout
        ...(withTrial ? [] : [{ price: setupFeePriceId, quantity: 1 }]),
      ],
      allow_promotion_codes: true,
      success_url: `${appUrl}/?checkout=success`,
      cancel_url: `${appUrl}/?checkout=cancelled#pricing`,
      metadata: {
        plan,
        billingCycle,
      },
      subscription_data: {
        // For trial: defer setup fee to first invoice after trial ends
        ...(withTrial ? {
          trial_period_days: TRIAL_DAYS,
          add_invoice_items: [{ price: setupFeePriceId, quantity: 1 }],
        } : {}),
        metadata: {
          plan,
          billingCycle,
        },
      },
      ...(customerEmail ? { customer_email: customerEmail } : {}),
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    console.error("Stripe checkout error:", error);
    const message = error instanceof Error ? error.message : "Unable to start checkout.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
