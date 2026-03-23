"use client";

import { motion } from "framer-motion";
import { PhoneOff, Clock, TrendingUp, MessageSquare } from "lucide-react";

const outcomes = [
  {
    icon: PhoneOff,
    stat: "5–10",
    label: "after-hours leads captured per month",
    description:
      "Most service businesses miss 30–50% of inquiries outside office hours. Latchly catches every one.",
  },
  {
    icon: Clock,
    stat: "< 3 sec",
    label: "average response time",
    description:
      "Visitors get instant answers — no hold music, no voicemail, no waiting until Monday.",
  },
  {
    icon: TrendingUp,
    stat: "2–3×",
    label: "more website conversions",
    description:
      "Businesses with live chat convert visitors at 2–3× the rate of static contact forms.",
  },
  {
    icon: MessageSquare,
    stat: "24/7",
    label: "coverage, zero extra staff",
    description:
      "Nights, weekends, holidays — your AI agent never calls in sick.",
  },
];

export default function TestimonialsSection() {
  return (
    <section className="py-20 px-5 bg-white">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <p className="text-sm font-bold text-brand uppercase tracking-widest mb-3">
            Results
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tight">
            What You Can Expect
          </h2>
          <p className="text-slate-500 mt-3 max-w-lg mx-auto text-sm leading-relaxed">
            Based on industry data from service businesses using AI chat assistants.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {outcomes.map((o, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-slate-50 rounded-2xl border border-slate-100 p-7 hover:-translate-y-1 hover:shadow-lg transition-all text-center"
            >
              <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center text-brand mx-auto mb-4">
                <o.icon size={22} />
              </div>
              <div className="text-3xl font-black text-slate-900 mb-1">
                {o.stat}
              </div>
              <div className="text-sm font-bold text-brand mb-3">{o.label}</div>
              <p className="text-xs text-slate-500 leading-relaxed">
                {o.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
