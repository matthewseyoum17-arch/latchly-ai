"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function FinalCTA() {
  const [loading, setLoading] = useState(false);

  const handleTrialCheckout = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "solo", billingCycle: "monthly", trial: true }),
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
      setLoading(false);
    }
  };

  return (
    <section className="py-8 px-5">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="max-w-4xl mx-auto bg-slate-900 rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden"
      >
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-brand/10 pointer-events-none" />

        <h2 className="font-display text-3xl sm:text-4xl font-black text-white mb-4 relative">
          Every hour without Latchly is a lead you&apos;ll never get back
        </h2>
        <p className="text-slate-400 text-lg mb-8 relative">
          Join local businesses already capturing more leads, 24/7
        </p>
        <Button size="lg" className="relative gap-2" onClick={handleTrialCheckout} disabled={loading}>
          {loading ? "Redirecting..." : <>Start Your Free 14-Day Pilot <ArrowRight size={16} /></>}
        </Button>
        <p className="text-slate-500 text-xs mt-4 relative">
          Card required. No charge for 14 days — then $510 (Solo plan + one-time setup).
        </p>
      </motion.div>
    </section>
  );
}
