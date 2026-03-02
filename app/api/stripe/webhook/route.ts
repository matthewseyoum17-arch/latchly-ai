import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import Stripe from "stripe";
import { getStripe, isBillingCycle, isBillingPlan, resolvePlanFromPriceId } from "@/lib/stripe";

export const runtime = "nodejs";

interface UpsertSubscriptionInput {
  email: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string;
  plan: string | null;
  billingCycle: string | null;
  status: string;
  priceId: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

function getCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!customer) return null;
  if (typeof customer === "string") return customer;
  return customer.id;
}

function normalizeBillingCycle(value: unknown): "monthly" | "annual" | null {
  if (isBillingCycle(value)) return value;
  return null;
}

function normalizePlan(value: unknown): "solo" | "team" | "multi" | null {
  if (isBillingPlan(value)) return value;
  return null;
}

async function ensureBillingTable(sql: ReturnType<typeof neon>) {
  await sql`
    CREATE TABLE IF NOT EXISTS billing_subscriptions (
      id SERIAL PRIMARY KEY,
      email TEXT,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT UNIQUE,
      plan TEXT,
      billing_cycle TEXT,
      status TEXT NOT NULL,
      price_id TEXT,
      current_period_end TIMESTAMP,
      cancel_at_period_end BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
}

async function upsertSubscription(sql: ReturnType<typeof neon>, input: UpsertSubscriptionInput) {
  await sql`
    INSERT INTO billing_subscriptions (
      email,
      stripe_customer_id,
      stripe_subscription_id,
      plan,
      billing_cycle,
      status,
      price_id,
      current_period_end,
      cancel_at_period_end,
      updated_at
    )
    VALUES (
      ${input.email},
      ${input.stripeCustomerId},
      ${input.stripeSubscriptionId},
      ${input.plan},
      ${input.billingCycle},
      ${input.status},
      ${input.priceId},
      ${input.currentPeriodEnd},
      ${input.cancelAtPeriodEnd},
      NOW()
    )
    ON CONFLICT (stripe_subscription_id)
    DO UPDATE SET
      email = EXCLUDED.email,
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      plan = EXCLUDED.plan,
      billing_cycle = EXCLUDED.billing_cycle,
      status = EXCLUDED.status,
      price_id = EXCLUDED.price_id,
      current_period_end = EXCLUDED.current_period_end,
      cancel_at_period_end = EXCLUDED.cancel_at_period_end,
      updated_at = NOW()
  `;
}

function extractSubscriptionSnapshot(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0];
  const priceId = item?.price?.id ?? null;
  const mapped = resolvePlanFromPriceId(priceId);

  const subscriptionCycleFromPrice = item?.price?.recurring?.interval === "year" ? "annual" : "monthly";
  const metadataPlan = normalizePlan(subscription.metadata?.plan);
  const metadataCycle = normalizeBillingCycle(subscription.metadata?.billingCycle);

  return {
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: getCustomerId(subscription.customer),
    email: null,
    status: subscription.status,
    priceId,
    plan: metadataPlan ?? mapped?.plan ?? null,
    billingCycle: metadataCycle ?? mapped?.billingCycle ?? subscriptionCycleFromPrice,
    currentPeriodEnd: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };
}

async function handleCheckoutCompleted(
  sql: ReturnType<typeof neon>,
  stripe: Stripe,
  session: Stripe.Checkout.Session
) {
  if (!session.subscription) return;

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription.id;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });

  const snapshot = extractSubscriptionSnapshot(subscription);
  const sessionPlan = normalizePlan(session.metadata?.plan);
  const sessionCycle = normalizeBillingCycle(session.metadata?.billingCycle);

  await upsertSubscription(sql, {
    ...snapshot,
    email: session.customer_details?.email ?? session.customer_email ?? null,
    plan: sessionPlan ?? snapshot.plan,
    billingCycle: sessionCycle ?? snapshot.billingCycle,
  });
}

async function handleSubscriptionChanged(sql: ReturnType<typeof neon>, subscription: Stripe.Subscription) {
  const snapshot = extractSubscriptionSnapshot(subscription);
  await upsertSubscription(sql, snapshot);
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Missing STRIPE_WEBHOOK_SECRET environment variable." },
      { status: 500 }
    );
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Missing DATABASE_URL environment variable." }, { status: 500 });
  }

  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature header." }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Invalid webhook signature.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    await ensureBillingTable(sql);

    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutCompleted(sql, stripe, event.data.object as Stripe.Checkout.Session);
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await handleSubscriptionChanged(sql, event.data.object as Stripe.Subscription);
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error("Stripe webhook error:", error);
    const message = error instanceof Error ? error.message : "Webhook processing failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
