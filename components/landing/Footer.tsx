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
    <footer className="bg-slate-900 pt-16 pb-0 px-5 text-slate-400">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-sky-500 flex items-center justify-center text-white">
                <Zap size={16} />
              </div>
              <span className="font-extrabold text-lg text-white">Latchly</span>
            </div>
            <p className="text-sm leading-relaxed mb-3">
              AI-powered chat assistants that capture leads 24/7 for service-based businesses.
            </p>
            <p className="text-xs text-slate-500">📍 Gainesville, FL</p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-5">
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
                  className="text-sm text-slate-500 hover:text-white transition-colors text-left cursor-pointer"
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* Industries */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-5">
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
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-5">
              Contact
            </h4>
            <div className="flex flex-col gap-3 text-sm">
              <span>📧 matt@latchlyai.com</span>
              <span>📞 (786) 390-0299</span>
              <span>🕐 Mon–Fri, 9am–6pm ET</span>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 py-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-xs text-slate-600">
            © 2026 Latchly. All rights reserved.
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
