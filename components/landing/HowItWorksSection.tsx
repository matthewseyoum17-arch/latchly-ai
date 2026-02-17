"use client";

import { motion } from "framer-motion";
import { MessageSquare, UserCheck, CalendarCheck, Bell, ArrowRight } from "lucide-react";

const steps = [
  {
    icon: <MessageSquare size={22} />,
    title: "Visitor lands on your site",
    desc: "Latchly greets them instantly. No wait time, no forms, no friction. Works 24/7 including nights, weekends, and holidays.",
    color: "bg-brand/10 text-brand",
  },
  {
    icon: <UserCheck size={22} />,
    title: "AI qualifies the lead",
    desc: "Asks the right questions one at a time: what service they need, their timeline, their contact info. No scripts, real conversation.",
    color: "bg-blue-50 text-blue-600",
  },
  {
    icon: <CalendarCheck size={22} />,
    title: "Books or captures",
    desc: "Team plan: books directly on your Calendly. Solo plan: captures contact info and notifies you instantly for follow-up.",
    color: "bg-purple-50 text-purple-600",
  },
  {
    icon: <Bell size={22} />,
    title: "You get notified",
    desc: "Email (all plans) or SMS + email (Team+) with the lead's name, phone, service needed, chat transcript, and booking link.",
    color: "bg-amber-50 text-amber-600",
  },
];

const integrations = [
  { name: "Calendly", desc: "Appointment booking" },
  { name: "Resend", desc: "Email notifications" },
  { name: "Anthropic", desc: "AI conversation engine" },
  { name: "Neon", desc: "Lead storage" },
  { name: "Vercel", desc: "Hosting + cron jobs" },
];

export default function HowItWorksSection() {
  return (
    <section className="py-14 px-5 bg-white">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <p className="text-sm font-bold text-brand uppercase tracking-widest mb-3">
            How It Works
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tight mb-3">
            From Visitor to Booked Appointment
          </h2>
          <p className="text-slate-500 max-w-lg mx-auto">
            Every step is automated. You only talk to qualified, warm leads.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-14">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="relative bg-slate-50 rounded-xl border border-slate-100 p-5"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${step.color}`}>
                  {step.icon}
                </div>
                <span className="text-xs font-bold text-slate-400">Step {i + 1}</span>
              </div>
              <h3 className="text-sm font-bold text-slate-800 mb-2">{step.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-3 text-slate-300">
                  <ArrowRight size={14} />
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* What you get + Integrations */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Deliverables */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-slate-50 rounded-xl border border-slate-100 p-6"
          >
            <h3 className="text-sm font-bold text-slate-700 mb-4">What you get on day one</h3>
            <ul className="space-y-2.5">
              {[
                "Custom-trained AI on your services, hours, and policies",
                "Branded chat widget installed on your site",
                "Lead notification emails on every new capture",
                "Dashboard to view leads, transcripts, and ratings",
                "Calendly booking integration (Team plan)",
                "Weekly performance summary email",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand mt-2 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Integrations */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 }}
            className="bg-slate-50 rounded-xl border border-slate-100 p-6"
          >
            <h3 className="text-sm font-bold text-slate-700 mb-4">Built on real infrastructure</h3>
            <div className="space-y-3">
              {integrations.map((int) => (
                <div key={int.name} className="flex items-center gap-3 py-1.5">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                    {int.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-700">{int.name}</div>
                    <div className="text-xs text-slate-400">{int.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
