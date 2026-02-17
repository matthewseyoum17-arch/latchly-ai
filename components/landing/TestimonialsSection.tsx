"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";

// TODO: Replace these placeholder testimonials with real ones
const testimonials = [
  {
    quote:
      "We were losing 5-6 calls a day to voicemail. Latchly captures those leads before they call our competitor.",
    name: "Dr. Sarah M.",
    business: "Dental Practice",
    stars: 5,
  },
  {
    quote:
      "Setup took less than 10 minutes. The AI knew our services, our hours, everything. My phone buzzes every time we get a new lead.",
    name: "Mike T.",
    business: "HVAC Company",
    stars: 5,
  },
  {
    quote:
      "I was skeptical about AI chat, but Latchly paid for itself in the first week. Two new clients from after-hours inquiries alone.",
    name: "Jennifer R.",
    business: "Law Firm",
    stars: 5,
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
            Testimonials
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tight">
            What Business Owners Say
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-slate-50 rounded-2xl border border-slate-100 p-7 hover:-translate-y-1 hover:shadow-lg transition-all"
            >
              {/* Stars */}
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: t.stars }).map((_, j) => (
                  <Star
                    key={j}
                    size={16}
                    className="text-amber-400 fill-amber-400"
                  />
                ))}
              </div>

              {/* Quote */}
              <p className="text-slate-700 text-sm leading-relaxed mb-6 italic">
                &ldquo;{t.quote}&rdquo;
              </p>

              {/* Attribution */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-brand font-bold text-sm">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800">{t.name}</div>
                  <div className="text-xs text-slate-500">{t.business}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
