"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Calculator, TrendingUp } from "lucide-react";

export default function ROICalculator() {
  const [missedCalls, setMissedCalls] = useState(3);
  const [avgValue, setAvgValue] = useState(250);
  const [marketingSpend, setMarketingSpend] = useState(250);

  const monthlyLoss = missedCalls * 4 * avgValue;
  const latchlyCost = 110;
  const roi = monthlyLoss > 0 ? Math.round(((monthlyLoss - latchlyCost) / latchlyCost) * 100) : 0;

  return (
    <section id="roi" className="py-10 px-5">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <p className="text-sm font-bold text-brand uppercase tracking-widest mb-3">
            ROI Calculator
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tight mb-4">
            See What You&apos;re Losing
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-slate-100 shadow-lg p-6 sm:p-10"
        >
          <div className="grid md:grid-cols-3 gap-6 mb-10">
            {/* Missed calls */}
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-2">
                Missed calls per week
              </label>
              <input
                type="range"
                min={1}
                max={30}
                value={missedCalls}
                onChange={(e) => setMissedCalls(Number(e.target.value))}
                className="w-full accent-brand mb-1"
              />
              <div className="text-center text-2xl font-black text-slate-800">
                {missedCalls}
              </div>
            </div>

            {/* Average job value */}
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-2">
                Average job / patient value
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                  $
                </span>
                <input
                  type="number"
                  value={avgValue}
                  onChange={(e) => setAvgValue(Number(e.target.value))}
                  className="w-full pl-7 pr-3 py-3 border border-slate-200 rounded-xl text-lg font-bold text-slate-800 outline-none focus:border-brand/50"
                />
              </div>
            </div>

            {/* Marketing spend */}
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-2">
                Current monthly marketing spend
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                  $
                </span>
                <input
                  type="number"
                  value={marketingSpend}
                  onChange={(e) => setMarketingSpend(Number(e.target.value))}
                  className="w-full pl-7 pr-3 py-3 border border-slate-200 rounded-xl text-lg font-bold text-slate-800 outline-none focus:border-brand/50"
                />
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="bg-slate-50 rounded-xl p-6 sm:p-8 space-y-4">
            <div className="flex items-start gap-3">
              <Calculator className="text-red-500 shrink-0 mt-1" size={20} />
              <div>
                <p className="text-slate-500 text-sm">
                  You&apos;re losing approximately
                </p>
                <p className="text-3xl font-black text-red-500">
                  ${monthlyLoss.toLocaleString()}/month
                </p>
                <p className="text-sm text-slate-400">in missed opportunities</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <TrendingUp className="text-brand shrink-0 mt-1" size={20} />
              <p className="text-slate-600">
                Latchly pays for itself by capturing just{" "}
                <span className="font-bold text-brand">1 extra lead per month</span>
              </p>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
              <p className="text-sm text-emerald-700 font-semibold mb-1">Your ROI</p>
              <p className="text-5xl font-black text-emerald-600">{roi}%</p>
            </div>

            <p className="text-xs text-slate-400 mt-4">
              Estimates based on your inputs. Assumes missed calls and unanswered website visitors convert to leads at current close rates.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
