"use client";

import { useState } from "react";
import { Zap, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = ["Demo", "ROI", "Industries", "Pricing", "FAQ"];

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileOpen(false);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/85 backdrop-blur-xl border-b border-slate-100">
      <div className="max-w-7xl mx-auto flex justify-between items-center h-16 px-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-sky-500 flex items-center justify-center text-white">
            <Zap size={16} />
          </div>
          <span className="font-extrabold text-lg tracking-tight">Latchly</span>
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {navItems.map((item) => (
            <button
              key={item}
              onClick={() => scrollTo(item.toLowerCase())}
              className="text-sm font-semibold text-slate-500 hover:text-brand transition-colors cursor-pointer"
            >
              {item}
            </button>
          ))}
          <Button size="sm" onClick={() => scrollTo("demo")}>
            Try Live Demo
          </Button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 text-slate-600"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-slate-100 px-5 py-4 flex flex-col gap-3 animate-fade-in">
          {navItems.map((item) => (
            <button
              key={item}
              onClick={() => scrollTo(item.toLowerCase())}
              className="text-left text-sm font-semibold text-slate-600 py-2"
            >
              {item}
            </button>
          ))}
          <Button size="sm" onClick={() => scrollTo("demo")} className="mt-2">
            Try Live Demo
          </Button>
        </div>
      )}
    </nav>
  );
}
