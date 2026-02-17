"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    q: "How hard is setup?",
    a: "We handle everything. During your onboarding call, we train the AI on your business, install the widget on your site, and configure your notification preferences. Most businesses are live within 24 hours.",
  },
  {
    q: "What if the AI says something wrong?",
    a: "Latchly is trained specifically on YOUR business information — your services, hours, policies, and FAQs. It won't make things up. And you can review every conversation in your dashboard.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. No long-term contracts. Cancel anytime with one click. We also offer a 14-day free pilot so you can see the results before committing.",
  },
  {
    q: "Will this replace my receptionist?",
    a: "No — it supports them. Latchly handles the overflow: after-hours inquiries, website visitors who won't call, and busy periods when your team can't pick up. Think of it as a 24/7 backup that never calls in sick.",
  },
  {
    q: "How is this different from a basic chatbot?",
    a: "Most chatbots follow rigid scripts. Latchly uses advanced AI that understands context, handles follow-up questions naturally, and sounds like a real member of your team — not a robot.",
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-20 px-5 bg-slate-50">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <p className="text-sm font-bold text-brand uppercase tracking-widest mb-3">
            FAQ
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tight">
            Common Questions
          </h2>
        </motion.div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full px-6 py-5 flex justify-between items-center text-left cursor-pointer"
              >
                <span className="text-[15px] font-bold text-slate-800 pr-4">
                  {faq.q}
                </span>
                <ChevronDown
                  size={18}
                  className={`text-slate-400 shrink-0 transition-transform duration-300 ${
                    openIndex === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              <AnimatePresence initial={false}>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-5 text-sm text-slate-500 leading-relaxed">
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
