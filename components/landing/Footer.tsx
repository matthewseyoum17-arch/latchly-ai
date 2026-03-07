"use client";

import { Zap } from "lucide-react";

export default function Footer() {
  const scrollTo = (id: string) => {
    if (id === "top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <footer className="bg-slate-900 pt-16 pb-0 px-5 text-slate-400 relative overflow-hidden">
      {/* Subtle top border gradient */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand/30 to-transparent" />

      <div className="max-w-7xl mx-auto relative">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white shadow-glow-brand">
                <Zap size={16} strokeWidth={2.5} />
              </div>
              <span className="font-extrabold text-lg text-white">Latchly</span>
            </div>
            <p className="text-sm leading-relaxed mb-4 text-slate-500">
              AI sales agents that qualify leads, book appointments, and capture contact info 24/7 for service-based businesses.
            </p>
            <p className="text-xs text-slate-600">Gainesville, FL</p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-widest mb-5">
              Quick Links
            </h4>
            <div className="flex flex-col gap-3">
              {[
                { label: "Home", id: "top" },
                { label: "Demo", id: "demo" },
                { label: "Pricing", id: "pricing" },
                { label: "FAQ", id: "faq" },
              ].map((l) => (
                <button
                  key={l.label}
                  onClick={() => scrollTo(l.id)}
                  className="text-sm text-slate-500 hover:text-brand transition-colors text-left cursor-pointer"
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* Industries */}
          <div>
            <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-widest mb-5">
              Industries
            </h4>
            <div className="flex flex-col gap-3">
              {["Dental", "HVAC", "Legal", "Med Spa", "Plumbing", "Real Estate"].map(
                (l) => (
                  <span key={l} className="text-sm text-slate-500">
                    {l}
                  </span>
                )
              )}
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-widest mb-5">
              Contact
            </h4>
            <div className="flex flex-col gap-3.5 text-sm text-slate-500">
              <a href="mailto:matt@latchlyai.com" className="hover:text-brand transition-colors">
                matt@latchlyai.com
              </a>
              <a href="tel:+17863900299" className="hover:text-brand transition-colors">
                (786) 390-0299
              </a>
              <span>Mon to Fri, 9am to 6pm ET</span>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800/80 py-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-xs text-slate-600">
            &copy; 2026 Latchly. All rights reserved.
          </div>
          <div className="flex gap-6">
            {["Privacy Policy", "Terms of Service"].map((l) => (
              <a
                key={l}
                href="#"
                className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
              >
                {l}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
