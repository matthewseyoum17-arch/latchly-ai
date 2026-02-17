"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function FinalCTA() {
  return (
    <section className="py-12 px-5">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="max-w-4xl mx-auto bg-slate-900 rounded-3xl p-10 sm:p-16 text-center relative overflow-hidden"
      >
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-brand/10 pointer-events-none" />

        <h2 className="font-display text-3xl sm:text-4xl font-black text-white mb-4 relative">
          Every hour without Latchly is a lead you&apos;ll never get back
        </h2>
        <p className="text-slate-400 text-lg mb-8 relative">
          Join local businesses already capturing more leads, 24/7
        </p>
        <Button size="lg" className="relative gap-2">
          Start Your Free 14-Day Pilot <ArrowRight size={16} />
        </Button>
      </motion.div>
    </section>
  );
}
