"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const plans = [
  {
    id: "solo",
    name: "Solo",
    monthly: 110,
    annual: 1056,
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
    monthly: 250,
    annual: 2400,
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
    annual: 4308,
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

  return (
    <section id="pricing" className="py-10 px-5 bg-slate-50">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-6"
        >
          <p className="text-sm font-bold text-brand uppercase tracking-widest mb-3">
            Pricing
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tight mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto">
            Missed leads cost more than software. Latchly starts at $3.67/day.
          </p>
        </motion.div>

        {/* Annual toggle */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <span
            className={`text-sm font-semibold ${!annual ? "text-slate-800" : "text-slate-400"}`}
          >
            Monthly
          </span>
          <button
            onClick={() => setAnnual(!annual)}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              annual ? "bg-brand" : "bg-slate-300"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                annual ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
          <span
            className={`text-sm font-semibold ${annual ? "text-slate-800" : "text-slate-400"}`}
          >
            Annual{" "}
            <Badge variant="success" className="ml-1">
              Save 20%
            </Badge>
          </span>
        </div>

        <div className="grid md:grid-cols-3 gap-6 items-start mb-8">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative rounded-2xl ${
                plan.popular
                  ? "bg-gradient-to-br from-brand to-brand-dark p-[3px]"
                  : "border border-slate-100"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                  <Badge variant="warning" className="px-4 py-1 text-xs font-bold">
                    Most Popular
                  </Badge>
                </div>
              )}
              <div
                className={`bg-white rounded-2xl p-7 h-full ${
                  plan.popular ? "border-0" : ""
                }`}
              >
                <div className="text-sm font-bold text-brand mb-1">{plan.name}</div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-black tracking-tight">
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
                >
                  {plan.cta}
                </Button>

                <ul className="space-y-3">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2.5 text-sm text-slate-600"
                    >
                      <Check size={14} className="text-brand shrink-0 mt-0.5" />
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
