"use client";

import { motion } from "framer-motion";
import { Stethoscope, Snowflake, Scale, Check } from "lucide-react";

const industries = [
  {
    icon: <Stethoscope size={28} />,
    emoji: "🦷",
    title: "Never Miss a New Patient Again",
    industry: "Dental",
    bullets: [
      "Qualifies new patients and collects insurance details instantly",
      "Books appointments directly via Calendly (Team plan)",
      "Routes emergency cases and captures after-hours leads",
      "Hands off warm leads to your front desk with full context",
    ],
  },
  {
    icon: <Snowflake size={28} />,
    emoji: "❄️",
    title: "Capture Emergency Calls 24/7",
    industry: "HVAC",
    bullets: [
      "Qualifies emergency vs. routine requests by priority level",
      "Validates service area by zip code before scheduling",
      "Upsells seasonal maintenance plans and upgrades",
      "Books same-day service calls for qualified leads",
    ],
  },
  {
    icon: <Scale size={28} />,
    emoji: "⚖️",
    title: "Qualify Leads Before the Consultation",
    industry: "Legal",
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
    <section id="industries" className="py-10 px-5 bg-white">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <p className="text-sm font-bold text-brand uppercase tracking-widest mb-3">
            Industries
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tight mb-4">
            Built for Your Business
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {industries.map((ind, i) => (
            <motion.div
              key={ind.industry}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-slate-50 rounded-2xl border border-slate-100 p-7 hover:-translate-y-1 hover:shadow-lg transition-all"
            >
              <div className="text-4xl mb-4">{ind.emoji}</div>
              <div className="text-xs font-bold text-brand uppercase tracking-wider mb-2">
                {ind.industry}
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-5">{ind.title}</h3>
              <ul className="space-y-3">
                {ind.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm text-slate-600 leading-relaxed">
                    <Check size={14} className="text-brand shrink-0 mt-1" />
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
