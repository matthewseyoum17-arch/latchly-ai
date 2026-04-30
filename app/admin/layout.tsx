"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ChevronRight,
  LogOut,
  Mail,
  Menu,
  Send,
  Users,
  X,
} from "lucide-react";
import { clearClientAuth } from "@/components/admin/auth-gate";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const NAV: NavItem[] = [
  {
    href: "/admin/leads-crm",
    label: "CRM",
    icon: <Users size={16} />,
    description: "Scored leads + status workflow + outreach state inline",
  },
  {
    href: "/admin/cold-email",
    label: "Cold Email",
    icon: <Send size={16} />,
    description: "Pending QA · Sent history",
  },
  {
    href: "/admin/analytics",
    label: "Analytics",
    icon: <BarChart3 size={16} />,
    description: "Opens · clicks · per-lead engagement",
  },
];

// Wrapping layout. Provides the sticky sidebar navigation across every admin
// route. Each page still owns its AuthGate today — the layout just renders
// nav and a logout. When the unified AuthGate session key (latchly-admin-auth)
// is fully adopted by every page, this layout can hoist the gate up itself.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await fetch("/api/dashboard/auth", { method: "DELETE" }).catch(() => null);
    clearClientAuth();
    if (typeof window !== "undefined") {
      window.location.href = "/admin/leads-crm";
    }
  };

  const activeIndex = NAV.findIndex(item => pathname?.startsWith(item.href));

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-40 bg-slate-950 text-white border-b border-slate-800">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg hover:bg-slate-800"
            aria-label="Open navigation"
          >
            <Menu size={18} />
          </button>
          <span className="font-black text-sm tracking-wide">
            Latchly · {NAV[activeIndex]?.label || "Admin"}
          </span>
          <span className="w-9" />
        </div>
      </div>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-60 shrink-0 sticky top-0 h-screen bg-slate-950 text-white flex-col">
          <SidebarContent
            activeHref={pathname}
            onNavigate={() => {}}
            onLogout={handleLogout}
          />
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <>
            <div
              className="lg:hidden fixed inset-0 bg-black/40 z-40"
              onClick={() => setMobileOpen(false)}
              aria-hidden
            />
            <aside className="lg:hidden fixed inset-y-0 left-0 w-64 z-50 bg-slate-950 text-white flex flex-col shadow-xl">
              <SidebarContent
                activeHref={pathname}
                onNavigate={() => setMobileOpen(false)}
                onLogout={handleLogout}
                onClose={() => setMobileOpen(false)}
              />
            </aside>
          </>
        )}

        {/* Page content */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

interface SidebarContentProps {
  activeHref: string | null;
  onNavigate: () => void;
  onLogout: () => void;
  onClose?: () => void;
}

function SidebarContent({ activeHref, onNavigate, onLogout, onClose }: SidebarContentProps) {
  return (
    <>
      <div className="px-5 py-5 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-teal-500 text-slate-950 flex items-center justify-center font-black text-sm">
            L
          </div>
          <div className="leading-tight">
            <div className="text-sm font-black tracking-wide">Latchly</div>
            <div className="text-[10px] uppercase tracking-widest text-slate-400">Admin</div>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden inline-flex items-center justify-center w-8 h-8 rounded hover:bg-slate-800 text-slate-300"
            aria-label="Close navigation"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        <ul className="px-3 space-y-1">
          {NAV.map((item) => {
            const active = activeHref?.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={`group flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                    active
                      ? "bg-teal-500/15 text-teal-200"
                      : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <span className={`w-7 h-7 rounded-md flex items-center justify-center ${active ? "bg-teal-500 text-slate-950" : "bg-slate-800/80 text-slate-300 group-hover:bg-slate-700"}`}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </span>
                  <ChevronRight size={14} className={active ? "text-teal-300" : "text-slate-500"} />
                </Link>
                <p className={`px-3 mt-1 text-[10px] leading-snug ${active ? "text-teal-300/80" : "text-slate-500"}`}>
                  {item.description}
                </p>
              </li>
            );
          })}
        </ul>

        <div className="px-3 mt-6">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 px-3 mb-2">
            Send window
          </div>
          <div className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 leading-snug">
            <div className="flex items-center gap-1.5 text-slate-100 font-bold mb-1">
              <Mail size={12} className="text-teal-300" />
              Autonomous
            </div>
            7-9am local · drains every 15min Mon-Fri 10:00-17:00 UTC
          </div>
        </div>
      </nav>

      <div className="px-3 py-3 border-t border-slate-800/80">
        <button
          type="button"
          onClick={onLogout}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-slate-200 px-3 py-2 text-sm font-bold transition-colors"
        >
          <LogOut size={14} /> Log out
        </button>
      </div>
    </>
  );
}
