"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle, Sparkles } from "lucide-react";

export default function LeadCaptureSection() {
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !businessName) return;
    setLoading(true);
    try {
      await fetch("/api/lead-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, businessName }),
      });
      setSubmitted(true);
    } catch {
      // still show success to not block UX
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="py-16 px-5">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="max-w-2xl mx-auto bg-gradient-to-br from-brand/5 via-emerald-50/50 to-white rounded-3xl border border-brand/10 p-8 sm:p-12 text-center"
      >
        {submitted ? (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle size={40} className="text-brand" />
            <h3 className="font-display text-2xl font-black text-slate-900">
              We&apos;ll be in touch!
            </h3>
            <p className="text-sm text-slate-500">
              Look for an email from matt@latchlyai.com with your free website audit.
            </p>
          </div>
        ) : (
          <>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand/10 text-xs font-bold text-brand mb-4">
              <Sparkles size={12} />
              Free — No card required
            </div>
            <h3 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-slate-900 mb-2">
              Get a Free Website Audit
            </h3>
            <p className="text-sm text-slate-500 mb-8 max-w-md mx-auto leading-relaxed">
              We&apos;ll review your site for missed leads, chatbot opportunities, and conversion
              gaps — then send you a personalized report.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
              <input
                type="text"
                placeholder="Business name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand bg-white"
              />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand bg-white"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand-dark transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? "Sending…" : "Get Audit"}
                {!loading && <ArrowRight size={14} />}
              </button>
            </form>
          </>
        )}
      </motion.div>
    </section>
  );
}
