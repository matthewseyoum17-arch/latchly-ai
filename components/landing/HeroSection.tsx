"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MessageSquare, ArrowRight } from "lucide-react";

export default function HeroSection() {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="relative flex items-center pt-16 pb-10 px-5">
      {/* Background gradient blob */}
      <div className="absolute -top-48 -right-48 w-[600px] h-[600px] rounded-full bg-brand/3 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full bg-sky-500/3 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center w-full">
        {/* Left - Copy */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand/10 border border-brand/20 text-xs font-bold text-brand mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Your AI sales agent is live.
          </div>

          <h1 className="font-display text-4xl sm:text-5xl lg:text-[56px] font-black leading-[1.08] tracking-tight text-slate-900 mb-4">
            Stop Losing Leads{" "}
            <span className="bg-gradient-to-r from-brand to-sky-500 bg-clip-text text-transparent">
              While You&apos;re Busy
            </span>
          </h1>

          <p className="text-lg text-slate-500 leading-relaxed mb-6 max-w-lg">
            Latchly qualifies leads, captures contact info, and books appointments on your website 24/7. No missed calls, no lost revenue.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <Button size="lg" onClick={() => scrollTo("demo")} className="gap-2">
              See It In Action <ArrowRight size={16} />
            </Button>
            <a
              href="https://calendly.com/latchly/setup"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-xl text-base font-bold h-14 px-8 border-2 border-slate-200 text-slate-600 hover:border-brand hover:text-brand bg-white transition-all"
            >
              Book a Free 10-Min Setup Call
            </a>
          </div>

          {/* Trust bar */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-xs text-slate-400">
            <span>Built on</span>
            <div className="flex items-center gap-4">
              <span className="font-bold text-slate-500">Anthropic AI</span>
              <span className="font-bold text-slate-500">Vercel</span>
              <span className="font-bold text-slate-500">Calendly</span>
            </div>
          </div>
        </motion.div>

        {/* Right - Chat widget mockup */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="relative hidden lg:block"
        >
          {/* Browser frame mockup */}
          <div className="bg-white rounded-xl shadow-xl border border-slate-100 overflow-visible animate-float w-full">
            {/* Browser bar */}
            <div className="bg-slate-50 border-b border-slate-100 px-3 py-2 flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              </div>
              <div className="flex-1 bg-white rounded px-2 py-0.5 text-[10px] text-slate-400 border border-slate-200">
                demo.yourbusiness.com
              </div>
            </div>

            {/* Fake page content with chat widget inside */}
            <div className="p-2.5 bg-slate-50 min-h-[140px] flex flex-col">
              <div className="h-2 w-24 bg-slate-200 rounded mb-1" />
              <div className="h-1.5 w-full bg-slate-100 rounded mb-0.5" />
              <div className="h-1.5 w-2/3 bg-slate-100 rounded mb-1.5" />
              <div className="h-4 w-16 bg-brand/10 rounded mb-2" />
              
              {/* Chat widget preview - fully contained */}
              <div className="mt-auto w-44 bg-white rounded-md shadow-md border border-slate-200 overflow-hidden self-end">
                <div className="bg-gradient-to-br from-brand to-brand-dark px-3 py-2 flex items-center gap-1.5 text-white">
                  <div className="w-6 h-6 rounded bg-white/20 flex items-center justify-center text-xs">
                    🦷
                  </div>
                  <div>
                    <div className="text-[11px] font-bold">Dental Office</div>
                    <div className="text-[9px] opacity-80 flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-emerald-400 inline-block" />
                      Online
                    </div>
                  </div>
                </div>
                <div className="p-2 space-y-1.5 bg-slate-50">
                  <div className="bg-white rounded-lg rounded-bl-sm p-2 text-[10px] text-slate-700 shadow-sm max-w-[90%]">
                    Hi! 👋 How can I help you today?
                  </div>
                  <div className="flex justify-end">
                    <div className="bg-brand text-white rounded-lg rounded-br-sm p-2 text-[10px] max-w-[90%]">
                      Do you accept Delta Dental?
                    </div>
                  </div>
                  <div className="bg-white rounded-lg rounded-bl-sm p-2 text-[10px] text-slate-700 shadow-sm max-w-[90%]">
                    Yes, we accept Delta Dental!
                  </div>
                </div>
                <div className="px-2 pb-1.5 flex gap-1 bg-slate-50">
                  {["Book", "Insurance", "Hours"].map((t) => (
                    <span
                      key={t}
                      className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold border border-brand/20 text-brand bg-brand/5"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Floating badges - overlapping edges of mockup */}
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-2 -right-4 bg-white rounded-xl px-4 py-2.5 shadow-lg flex items-center gap-2 border border-slate-100 z-10"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-sm">
              📱
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-800">New lead captured!</div>
              <div className="text-[10px] text-slate-400">Just now</div>
            </div>
          </motion.div>

          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
            className="absolute -bottom-2 -left-4 bg-white rounded-xl px-4 py-2.5 shadow-lg border border-slate-100 z-10"
          >
            <div className="text-[10px] text-slate-500 font-semibold">After-hours coverage</div>
            <div className="text-xl font-black text-brand">24/7</div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
