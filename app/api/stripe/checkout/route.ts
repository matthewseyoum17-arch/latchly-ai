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

interface CheckoutBody {
  plan?: unknown;
  billingCycle?: unknown;
  customerEmail?: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CheckoutBody;
    const plan = body.plan;
    const billingCycle = body.billingCycle ?? "monthly";

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
        { price: setupFeePriceId, quantity: 1 },
      ],
      allow_promotion_codes: true,
      success_url: `${appUrl}/?checkout=success`,
      cancel_url: `${appUrl}/?checkout=cancelled#pricing`,
      metadata: {
        plan,
        billingCycle,
      },
      subscription_data: {
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
    const e = error as Record<string, unknown>;
    const detail = {
      name: error instanceof Error ? error.name : typeof error,
      envKey: process.env.STRIPE_SECRET_KEY ? `${(process.env.STRIPE_SECRET_KEY as string).slice(0, 10)}...` : "MISSING",
      raw: JSON.stringify(e.raw ?? null),
      stack: error instanceof Error ? (error.stack?.split("\n")[1] ?? "") : "",
    };
    return NextResponse.json({ error: message, ...detail }, { status: 500 });
  }
}
