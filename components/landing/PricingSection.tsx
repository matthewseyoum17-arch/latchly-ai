"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type BillingPlan = "solo" | "team" | "multi";
type BillingCycle = "monthly" | "annual";

interface Plan {
  id: BillingPlan;
  name: string;
  monthly: number;
  annual: number;
  desc: string;
  features: string[];
  cta: string;
  popular: boolean;
}

const CALENDLY_SETUP_URL = "https://calendly.com/latchly/setup";

const plans: Plan[] = [
  {
    id: "solo",
    name: "Solo",
    monthly: 149,
    annual: 1524,
    desc: "For single-location businesses",
    features: [
      "Up to 500 conversations/month",
      "1 chat widget",
      "Lead qualification + capture",
      "Email lead notifications",
      "Basic analytics dashboard",
    ],
    cta: "Get Started",
    popular: false,
  },
  {
    id: "team",
    name: "Team",
    monthly: 249,
    annual: 2544,
    desc: "For growing practices and shops",
    features: [
      "Unlimited conversations",
      "Custom branding and colors",
      "SMS + email lead notifications",
      "Appointment booking integration (Calendly)",
      "Booking rules (hours, buffers, service types)",
      "Priority support",
      "Weekly performance reports",
    ],
    cta: "Get Started",
    popular: true,
  },
  {
    id: "multi",
    name: "Multi-Location",
    monthly: 449,
    annual: 4584,
    desc: "For businesses with 2+ locations",
    features: [
      "Everything in Team",
      "Multiple widget deployments",
      "Location-specific AI training",
      "Location routing for leads",
      "Dedicated account manager",
      "Custom integrations",
    ],
    cta: "Contact Us",
    popular: false,
  },
];

export default function PricingSection() {
  const [annual, setAnnual] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<BillingPlan | null>(null);

  const handleCheckout = async (planId: BillingPlan) => {
    if (planId === "multi") {
      window.open(CALENDLY_SETUP_URL, "_blank", "noopener,noreferrer");
      return;
    }

    const billingCycle: BillingCycle = annual ? "annual" : "monthly";
    setLoadingPlan(planId);

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId, billingCycle }),
      });

      const data = await res.json();
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Unable to start checkout.");
      }

      window.location.href = data.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start checkout.";
      window.alert(message);
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <section id="pricing" className="py-16 px-5 relative grain">
      <div className="absolute inset-0 bg-gradient-to-b from-surface-warm via-surface to-surface-warm" />
      <div className="max-w-6xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <p className="text-xs font-bold text-brand uppercase tracking-[0.2em] mb-3">
            Pricing
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tight mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto">
            Missed leads cost more than software. Latchly starts at $4.97/day.
          </p>
        </motion.div>

        {/* Annual toggle */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <span
            className={`text-sm font-semibold transition-colors ${!annual ? "text-slate-800" : "text-slate-400"}`}
          >
            Monthly
          </span>
          <button
            onClick={() => setAnnual(!annual)}
            className={`relative w-14 h-7 rounded-full transition-all cursor-pointer ${
              annual ? "bg-brand shadow-glow-brand" : "bg-slate-300"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform ${
                annual ? "translate-x-7" : "translate-x-0"
              }`}
            />
          </button>
          <span
            className={`text-sm font-semibold transition-colors ${annual ? "text-slate-800" : "text-slate-400"}`}
          >
            Annual{" "}
            <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700">
              Save 15%
            </span>
          </span>
        </div>

        <div className="grid md:grid-cols-3 gap-6 items-start mb-10">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative rounded-2xl transition-all duration-300 ${
                plan.popular
                  ? "bg-gradient-to-b from-brand via-brand to-brand-dark p-[2px] shadow-glow-brand-lg hover:shadow-glow-brand-lg scale-[1.02]"
                  : "border border-slate-200/60 hover:border-slate-300 hover:shadow-lifted"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                  <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-amber-400 to-amber-500 text-white shadow-lg">
                    <Sparkles size={12} />
                    Most Popular
                  </div>
                </div>
              )}
              <div
                className={`bg-white rounded-2xl p-7 h-full ${
                  plan.popular ? "" : ""
                }`}
              >
                <div className="text-sm font-bold text-brand mb-1">{plan.name}</div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-5xl font-black tracking-tight tabular-nums text-slate-900">
                    ${annual ? Math.round(plan.annual / 12) : plan.monthly}
                  </span>
                  <span className="text-sm text-slate-400 font-semibold">/mo</span>
                </div>
                {annual && (
                  <p className="text-xs text-slate-400 mb-1">
                    ${plan.annual.toLocaleString()}/year billed annually
                  </p>
                )}
                <p className="text-sm text-slate-500 mb-6">{plan.desc}</p>

                <Button
                  variant={plan.popular ? "default" : "secondary"}
                  className="w-full mb-6"
                  onClick={() => handleCheckout(plan.id)}
                  disabled={loadingPlan === plan.id}
                >
                  {loadingPlan === plan.id ? "Redirecting..." : plan.cta}
                </Button>

                <ul className="space-y-3">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2.5 text-sm text-slate-600"
                    >
                      <div className="w-5 h-5 rounded-md bg-brand-50 flex items-center justify-center shrink-0 mt-0.5">
                        <Check size={12} className="text-brand" />
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="text-center space-y-3">
          <p className="text-sm text-slate-500 max-w-2xl mx-auto">
            All plans include a{" "}
            <span className="font-bold text-slate-700">
              $400 one-time Done-For-You Setup
            </span>.
            We train your AI, install the widget, and walk you through
            everything.
          </p>
          <p className="text-sm font-semibold text-brand">
            Still cheaper than a single missed customer.
          </p>
        </div>
      </div>
    </section>
  );
}
