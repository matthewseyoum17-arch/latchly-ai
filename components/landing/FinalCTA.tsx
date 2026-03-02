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
    <section className="py-12 px-5">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="max-w-4xl mx-auto relative overflow-hidden rounded-3xl"
      >
        {/* Rich layered background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-brand-900" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(14,124,107,0.15)_0%,_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(14,124,107,0.1)_0%,_transparent_50%)]" />

        {/* Decorative elements */}
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-brand/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-52 h-52 rounded-full bg-brand/8 blur-3xl pointer-events-none" />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative p-8 sm:p-14 text-center">
          <h2 className="font-display text-3xl sm:text-4xl lg:text-[44px] font-black text-white mb-5 leading-tight">
            Every hour without Latchly is a lead you&apos;ll never get back
          </h2>
          <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto">
            Join local businesses already capturing more leads, 24/7
          </p>
          <Button
            size="lg"
            className="gap-2 group bg-white text-slate-900 hover:bg-slate-50 shadow-dramatic border-0 from-white to-white"
            onClick={handleTrialCheckout}
            disabled={loading}
          >
            {loading ? (
              "Redirecting..."
            ) : (
              <>
                Start Your Free 14-Day Pilot{" "}
                <ArrowRight
                  size={16}
                  className="group-hover:translate-x-0.5 transition-transform"
                />
              </>
            )}
          </Button>
          <p className="text-slate-500 text-xs mt-5">
            Card required. No charge for 14 days — then $510 (Solo plan + one-time setup).
          </p>
        </div>
      </motion.div>
    </section>
  );
}
