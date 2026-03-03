"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

export default function HeroSection() {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="relative flex items-center pt-24 pb-16 px-5 overflow-hidden grain min-h-[85vh]">
      {/* Rich layered background */}
      <div className="absolute inset-0 bg-gradient-to-b from-brand-50/60 via-transparent to-transparent" />
      <div className="absolute -top-48 -right-48 w-[700px] h-[700px] rounded-full bg-brand/[0.04] blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-48 w-[500px] h-[500px] rounded-full bg-brand-200/10 blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] rounded-full bg-emerald-200/10 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto w-full relative">
        {/* Centered Copy */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-3xl mx-auto"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur border border-brand/15 text-xs font-bold text-brand mb-6 shadow-soft mx-auto"
          >
            <Sparkles size={13} className="text-brand" />
            Your AI sales agent is live
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </motion.div>

          <h1 className="font-display text-[42px] sm:text-5xl lg:text-[58px] font-black leading-[1.06] tracking-tight text-slate-900 mb-5">
            Stop Losing Leads{" "}
            <span className="relative inline-block">
              <span className="bg-gradient-to-r from-brand via-brand-light to-emerald-400 bg-clip-text text-transparent">
                While You&apos;re Busy
              </span>
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-500 leading-relaxed mb-8 max-w-lg mx-auto">
            Latchly qualifies leads, captures contact info, and books appointments on your website{" "}
            <span className="font-semibold text-slate-700">24/7</span>. No missed calls, no lost revenue.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-8 justify-center">
            <Button size="lg" onClick={() => scrollTo("demo")} className="gap-2 group">
              See It In Action{" "}
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </Button>
            <a
              href="https://calendly.com/latchly/setup"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-xl text-base font-bold h-14 px-8 border-2 border-slate-200 text-slate-600 hover:border-brand hover:text-brand bg-white/80 backdrop-blur transition-all hover:-translate-y-0.5"
            >
              Book a Free 10-Min Setup Call
            </a>
          </div>

          {/* Trust bar */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-center">
            <span className="text-xs text-slate-400 tracking-wide uppercase">Built&nbsp;on</span>
            <div className="flex items-center gap-5">
              {["Anthropic AI", "Vercel", "Calendly"].map((name) => (
                <span
                  key={name}
                  className="text-[13px] font-bold text-slate-400 tracking-tight"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Right - Chat widget mockup (decorative, floating) */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="hidden lg:block lg:absolute lg:right-0 lg:top-1/2 lg:-translate-y-1/2 w-[340px] xl:w-[380px]"
        >
          {/* Decorative glow behind card */}
          <div className="absolute inset-0 -m-8 bg-gradient-to-br from-brand/8 to-emerald-200/10 rounded-3xl blur-2xl" />

          {/* Browser frame mockup */}
          <div className="relative bg-white rounded-2xl shadow-dramatic border border-slate-200/80 overflow-visible animate-float">
            {/* Browser bar */}
            <div className="bg-slate-50/80 border-b border-slate-200/60 px-4 py-2.5 flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
              </div>
              <div className="flex-1 bg-white rounded-lg px-3 py-1 text-[10px] text-slate-400 border border-slate-200/60">
                demo.yourbusiness.com
              </div>
            </div>

            {/* Fake page content with skeleton layout */}
            <div className="p-5 bg-gradient-to-b from-slate-50 to-white min-h-[280px] flex flex-col relative">
              <div className="space-y-3 mb-4">
                <div className="h-3 w-3/4 bg-slate-200/70 rounded-full" />
                <div className="h-2 w-full bg-slate-100 rounded-full" />
                <div className="h-2 w-5/6 bg-slate-100 rounded-full" />
                <div className="h-2 w-4/5 bg-slate-100 rounded-full" />
              </div>

              <div className="flex gap-3 mb-4">
                <div className="h-20 w-1/3 bg-slate-100 rounded-xl" />
                <div className="h-20 w-1/3 bg-slate-100 rounded-xl" />
                <div className="h-20 w-1/3 bg-slate-100 rounded-xl" />
              </div>

              <div className="space-y-2 mb-4">
                <div className="h-2 w-full bg-slate-100 rounded-full" />
                <div className="h-2 w-11/12 bg-slate-100 rounded-full" />
                <div className="h-2 w-3/4 bg-slate-100 rounded-full" />
              </div>

              {/* Chat widget - floating */}
              <div className="absolute bottom-4 right-4 w-52 bg-white rounded-xl shadow-lifted border border-slate-200/60 overflow-hidden">
                <div className="bg-gradient-to-br from-brand to-brand-dark px-3 py-2 flex items-center gap-1.5 text-white">
                  <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center text-xs">
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
                  <div className="bg-white rounded-xl rounded-bl-sm p-2 text-[10px] text-slate-700 shadow-sm max-w-[90%]">
                    Hi! How can I help you today?
                  </div>
                  <div className="flex justify-end">
                    <div className="bg-brand text-white rounded-xl rounded-br-sm p-2 text-[10px] max-w-[90%]">
                      Do you accept Delta Dental?
                    </div>
                  </div>
                  <div className="bg-white rounded-xl rounded-bl-sm p-2 text-[10px] text-slate-700 shadow-sm max-w-[90%]">
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

          {/* Floating badges */}
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-4 -right-6 bg-white rounded-2xl px-4 py-3 shadow-lifted flex items-center gap-3 border border-slate-200/60 z-10"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-sm">
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
            className="absolute -bottom-4 -left-6 bg-white rounded-2xl px-4 py-3 shadow-lifted border border-slate-200/60 z-10"
          >
            <div className="text-[10px] text-slate-500 font-semibold">After-hours coverage</div>
            <div className="text-2xl font-black text-brand tracking-tight">24/7</div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
