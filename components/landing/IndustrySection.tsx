"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

const industries = [
  {
    emoji: "🦷",
    title: "Never Miss a New Patient Again",
    industry: "Dental",
    color: "from-cyan-50 to-teal-50",
    borderColor: "border-teal-200/40",
    bullets: [
      "Qualifies new patients and collects insurance details instantly",
      "Books appointments directly via Calendly (Team plan)",
      "Routes emergency cases and captures after-hours leads",
      "Hands off warm leads to your front desk with full context",
    ],
  },
  {
    emoji: "❄️",
    title: "Capture Emergency Calls 24/7",
    industry: "HVAC",
    color: "from-blue-50 to-indigo-50",
    borderColor: "border-blue-200/40",
    bullets: [
      "Qualifies emergency vs. routine requests by priority level",
      "Validates service area by zip code before scheduling",
      "Upsells seasonal maintenance plans and upgrades",
      "Books same-day service calls for qualified leads",
    ],
  },
  {
    emoji: "⚖️",
    title: "Qualify Leads Before the Consultation",
    industry: "Legal",
    color: "from-amber-50 to-orange-50",
    borderColor: "border-amber-200/40",
    bullets: [
      "Classifies case type and routes to the right attorney",
      "Books consultations with conflict check disclaimers",
      "Completes intake before attorney review to save billable hours",
      "Captures after-hours leads and delivers them by morning",
    ],
  },
];

export default function IndustrySection() {
  return (
    <section id="industries" className="py-16 px-5 relative grain">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-surface to-transparent" />
      <div className="max-w-7xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <p className="text-xs font-bold text-brand uppercase tracking-[0.2em] mb-3">
            Industries
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tight mb-4">
            Built for Your Business
          </h2>
          <p className="text-slate-500 max-w-md mx-auto">
            Pre-configured for the industries that need it most
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {industries.map((ind, i) => (
            <motion.div
              key={ind.industry}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`group bg-gradient-to-br ${ind.color} rounded-2xl border ${ind.borderColor} p-7 hover:-translate-y-1.5 hover:shadow-lifted transition-all duration-300`}
            >
              <div className="text-4xl mb-4">{ind.emoji}</div>
              <div className="text-[11px] font-bold text-brand uppercase tracking-widest mb-2">
                {ind.industry}
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-5 leading-snug">{ind.title}</h3>
              <ul className="space-y-3">
                {ind.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm text-slate-600 leading-relaxed">
                    <div className="w-5 h-5 rounded-md bg-brand/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Check size={12} className="text-brand" />
                    </div>
                    {b}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
