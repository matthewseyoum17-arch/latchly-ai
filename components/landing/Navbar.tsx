"use client";

import { useState, useEffect } from "react";
import { Zap, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navItems = ["Demo", "ROI", "Industries", "Pricing", "FAQ", "Contact"];

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileOpen(false);
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/90 backdrop-blur-xl border-b border-slate-200/60 shadow-soft"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto flex justify-between items-center h-16 px-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white shadow-glow-brand">
            <Zap size={16} strokeWidth={2.5} />
          </div>
          <span className="font-extrabold text-[19px] tracking-tight text-slate-900">
            Latchly
          </span>
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) =>
            item === "Contact" ? (
              <a
                key={item}
                href="/contact"
                className="px-4 py-2 text-[13px] font-semibold text-slate-500 hover:text-brand rounded-lg hover:bg-brand/5 transition-all cursor-pointer"
              >
                {item}
              </a>
            ) : (
              <button
                key={item}
                onClick={() => scrollTo(item.toLowerCase())}
                className="px-4 py-2 text-[13px] font-semibold text-slate-500 hover:text-brand rounded-lg hover:bg-brand/5 transition-all cursor-pointer"
              >
                {item}
              </button>
            )
          )}
          <div className="ml-3 pl-3 border-l border-slate-200">
            <Button size="sm" onClick={() => scrollTo("demo")}>
              Try Live Demo
            </Button>
          </div>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 text-slate-600 hover:text-brand transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-xl border-t border-slate-100 px-5 py-4 flex flex-col gap-1 animate-fade-in shadow-lifted">
          {navItems.map((item) =>
            item === "Contact" ? (
              <a
                key={item}
                href="/contact"
                className="text-left text-sm font-semibold text-slate-600 py-3 px-3 rounded-lg hover:bg-brand/5 hover:text-brand transition-all"
              >
                {item}
              </a>
            ) : (
              <button
                key={item}
                onClick={() => scrollTo(item.toLowerCase())}
                className="text-left text-sm font-semibold text-slate-600 py-3 px-3 rounded-lg hover:bg-brand/5 hover:text-brand transition-all"
              >
                {item}
              </button>
            )
          )}
          <Button size="sm" onClick={() => scrollTo("demo")} className="mt-3">
            Try Live Demo
          </Button>
        </div>
      )}
    </nav>
  );
}
