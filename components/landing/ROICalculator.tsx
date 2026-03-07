"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Calculator, TrendingUp, DollarSign } from "lucide-react";

export default function ROICalculator() {
  const [missedCalls, setMissedCalls] = useState(3);
  const [avgValue, setAvgValue] = useState(250);
  const [marketingSpend, setMarketingSpend] = useState(250);

  const monthlyLoss = missedCalls * 4 * avgValue;
  const latchlyCost = 110;
  const roi = monthlyLoss > 0 ? Math.round(((monthlyLoss - latchlyCost) / latchlyCost) * 100) : 0;

  return (
    <section id="roi" className="py-16 px-5 relative">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <p className="text-xs font-bold text-brand uppercase tracking-[0.2em] mb-3">
            ROI Calculator
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tight mb-4">
            See What You&apos;re Losing
          </h2>
          <p className="text-slate-500 max-w-md mx-auto">
            Plug in your numbers. The math speaks for itself.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-slate-200/60 shadow-dramatic p-6 sm:p-10"
        >
          <div className="grid md:grid-cols-3 gap-8 mb-10">
            {/* Missed calls */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Missed calls per week
              </label>
              <input
                type="range"
                min={1}
                max={30}
                value={missedCalls}
                onChange={(e) => setMissedCalls(Number(e.target.value))}
                className="w-full mb-2"
              />
              <div className="text-center">
                <span className="text-3xl font-black text-slate-900 tabular-nums">
                  {missedCalls}
                </span>
                <span className="text-sm text-slate-400 ml-1">/ week</span>
              </div>
            </div>

            {/* Average job value */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Average job / patient value
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                  <DollarSign size={16} />
                </span>
                <input
                  type="number"
                  value={avgValue}
                  onChange={(e) => setAvgValue(Number(e.target.value))}
                  className="w-full pl-9 pr-3 py-3 border border-slate-200 rounded-xl text-lg font-bold text-slate-800 outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/10 transition-all"
                />
              </div>
            </div>

            {/* Marketing spend */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Monthly marketing spend
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                  <DollarSign size={16} />
                </span>
                <input
                  type="number"
                  value={marketingSpend}
                  onChange={(e) => setMarketingSpend(Number(e.target.value))}
                  className="w-full pl-9 pr-3 py-3 border border-slate-200 rounded-xl text-lg font-bold text-slate-800 outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/10 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="rounded-2xl overflow-hidden border border-slate-200/60">
            <div className="bg-gradient-to-r from-red-50 to-red-50/30 p-6 sm:p-8 border-b border-red-100/40">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                  <Calculator className="text-red-500" size={18} />
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">
                    You&apos;re losing approximately
                  </p>
                  <p className="text-4xl font-black text-red-500 tracking-tight tabular-nums">
                    ${monthlyLoss.toLocaleString()}
                    <span className="text-lg font-bold text-red-400">/month</span>
                  </p>
                  <p className="text-sm text-red-400/80 mt-1">in missed opportunities</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-emerald-50 to-emerald-50/30 p-6 sm:p-8">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                  <TrendingUp className="text-brand" size={18} />
                </div>
                <p className="text-slate-600">
                  Latchly pays for itself by capturing just{" "}
                  <span className="font-bold text-brand">1 extra lead per month</span>
                </p>
              </div>

              <div className="bg-white rounded-xl p-6 text-center shadow-soft border border-emerald-200/40">
                <p className="text-xs text-emerald-700 font-bold uppercase tracking-wider mb-2">Your ROI</p>
                <p className="text-6xl font-black text-brand tracking-tight tabular-nums">{roi}%</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400 mt-5 text-center">
            Estimates based on your inputs. Assumes missed calls and unanswered website visitors convert to leads at current close rates.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
