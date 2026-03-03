"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Users, Star, Calendar, Phone, Mail, Clock,
  Settings, BarChart3, List, Lock, Eye, EyeOff, RefreshCw,
  ChevronDown, Search, Check
} from "lucide-react";

interface Lead {
  id: number;
  name: string;
  phone: string;
  email: string;
  industry: string;
  rating: number;
  transcript: string;
  created_at: string;
}

interface Stats {
  totalLeads: number;
  todayLeads: number;
  weekLeads: number;
  avgRating: number;
}

interface IndustryCount {
  industry: string;
  count: number;
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded-lg ${className}`} />;
}

// ── Auth Gate ──────────────────────────────────────────────────

function AuthGate({ onAuth }: { onAuth: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) { setError("Invalid password"); return; }
      sessionStorage.setItem("latchly-dash-auth", "1");
      onAuth();
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-5">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8 w-full max-w-sm">
        <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center text-brand mb-5 mx-auto">
          <Lock size={22} />
        </div>
        <h1 className="text-xl font-bold text-center mb-1">Dashboard Login</h1>
        <p className="text-sm text-slate-500 text-center mb-6">Enter your dashboard password</p>
        <form onSubmit={submit}>
          <div className="relative mb-4">
            <input type={showPw ? "text" : "password"} value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="Password"
              className="w-full px-4 py-3 pr-10 rounded-xl border border-slate-200 text-sm outline-none focus:border-brand/50" autoFocus />
            <button type="button" onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
          <button type="submit" disabled={loading || !password}
            className="w-full py-3 rounded-xl bg-brand text-white font-bold text-sm disabled:opacity-50">
            {loading ? "Checking..." : "Sign In"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ── Stat Card ──────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>{icon}</div>
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-3xl font-black text-slate-800">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

// ── Overview Tab ───────────────────────────────────────────────

function OverviewTab({ stats, industryBreakdown, loading }: {
  stats: Stats | null; industryBreakdown: IndustryCount[]; loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 p-5">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Users size={16} className="text-brand" />} label="Total Leads"
          value={stats?.totalLeads ?? 0} sub="All time" color="bg-brand/10" />
        <StatCard icon={<Calendar size={16} className="text-blue-500" />} label="Today"
          value={stats?.todayLeads ?? 0} sub="New leads" color="bg-blue-50" />
        <StatCard icon={<BarChart3 size={16} className="text-purple-500" />} label="This Week"
          value={stats?.weekLeads ?? 0} sub="Last 7 days" color="bg-purple-50" />
        <StatCard icon={<Star size={16} className="text-amber-500" />} label="Avg Rating"
          value={stats?.avgRating ?? "—"} sub="Customer satisfaction" color="bg-amber-50" />
      </div>

      {industryBreakdown.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 p-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Leads by Industry</h3>
          <div className="space-y-3">
            {industryBreakdown.map((ind) => {
              const max = Math.max(...industryBreakdown.map((i) => Number(i.count)));
              const pct = max > 0 ? (Number(ind.count) / max) * 100 : 0;
              return (
                <div key={ind.industry} className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-500 w-20 capitalize">{ind.industry}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-brand h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-bold text-slate-700 w-8 text-right">{ind.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Leads Tab ──────────────────────────────────────────────────

function LeadsTab({ leads, loading, searchQuery, setSearchQuery }: {
  leads: Lead[]; loading: boolean; searchQuery: string; setSearchQuery: (q: string) => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-100 p-5">
            <div className="flex gap-4">
              <Skeleton className="w-10 h-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const filtered = leads.filter((l) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return l.name?.toLowerCase().includes(q) || l.phone?.includes(q) ||
      l.email?.toLowerCase().includes(q) || l.industry?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search leads by name, phone, email, industry..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-brand/50" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          {searchQuery ? "No leads match your search" : "No leads captured yet"}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((lead) => (
            <div key={lead.id} className="bg-white rounded-xl border border-slate-100 overflow-hidden">
              <button onClick={() => setExpanded(expanded === lead.id ? null : lead.id)}
                className="w-full px-5 py-4 flex items-center gap-4 text-left cursor-pointer hover:bg-slate-50/50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-brand font-bold text-sm shrink-0">
                  {lead.name ? lead.name.charAt(0).toUpperCase() : "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-800 truncate">{lead.name || "Unknown"}</span>
                    {lead.industry && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 uppercase">{lead.industry}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                    {lead.phone && <span className="flex items-center gap-1"><Phone size={10} />{lead.phone}</span>}
                    {lead.email && <span className="flex items-center gap-1"><Mail size={10} />{lead.email}</span>}
                    <span className="flex items-center gap-1"><Clock size={10} />{new Date(lead.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                {lead.rating && (
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: lead.rating }).map((_, i) => (
                      <Star key={i} size={12} className="text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                )}
                <ChevronDown size={16} className={`text-slate-400 transition-transform ${expanded === lead.id ? "rotate-180" : ""}`} />
              </button>

              {expanded === lead.id && lead.transcript && (
                <div className="px-5 pb-4 border-t border-slate-50">
                  <div className="mt-3 bg-slate-50 rounded-lg p-4 text-xs text-slate-600 leading-relaxed whitespace-pre-line max-h-48 overflow-y-auto">
                    {lead.transcript}
                  </div>
                  <div className="mt-3 flex gap-2">
                    {lead.phone && (
                      <a href={`tel:${lead.phone}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-bold">
                        <Phone size={12} /> Call
                      </a>
                    )}
                    {lead.email && (
                      <a href={`mailto:${lead.email}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold">
                        <Mail size={12} /> Email
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Settings Tab ───────────────────────────────────────────────

function SettingsTab() {
  const [notifyEmail, setNotifyEmail] = useState("");
  const [saved, setSaved] = useState(false);

  return (
    <div className="space-y-6 max-w-lg">
      <div className="bg-white rounded-xl border border-slate-100 p-6">
        <h3 className="text-sm font-bold text-slate-700 mb-4">Notification Settings</h3>
        <label className="text-xs font-semibold text-slate-500 block mb-1">Notification Email</label>
        <input type="email" value={notifyEmail} onChange={(e) => setNotifyEmail(e.target.value)}
          placeholder="matt@latchlyai.com"
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-brand/50 mb-4" />
        <p className="text-xs text-slate-400 mb-4">Set the <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">NOTIFY_EMAIL</code> environment variable in your Vercel deployment to change this permanently.</p>
        <button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}
          className="px-5 py-2.5 rounded-xl bg-brand text-white text-sm font-bold flex items-center gap-2">
          {saved ? <><Check size={14} /> Saved</> : "Save"}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-6">
        <h3 className="text-sm font-bold text-slate-700 mb-4">Environment Variables</h3>
        <div className="space-y-3 text-sm">
          {[
            { key: "ANTHROPIC_API_KEY", desc: "Claude API key for chat" },
            { key: "RESEND_API_KEY", desc: "Resend API key for email notifications" },
            { key: "DATABASE_URL", desc: "Neon Postgres connection string" },
            { key: "DASHBOARD_PASSWORD", desc: "Dashboard login password" },
            { key: "NOTIFY_EMAIL", desc: "Email address for lead notifications" },
            { key: "STRIPE_SECRET_KEY", desc: "Stripe secret key for checkout + webhooks" },
            { key: "STRIPE_WEBHOOK_SECRET", desc: "Stripe webhook signing secret" },
            { key: "STRIPE_PRICE_SOLO_MONTHLY", desc: "Stripe price ID for Solo monthly plan" },
            { key: "STRIPE_PRICE_SOLO_ANNUAL", desc: "Stripe price ID for Solo annual plan" },
            { key: "STRIPE_PRICE_TEAM_MONTHLY", desc: "Stripe price ID for Team monthly plan" },
            { key: "STRIPE_PRICE_TEAM_ANNUAL", desc: "Stripe price ID for Team annual plan" },
            { key: "STRIPE_PRICE_SETUP_FEE", desc: "Stripe price ID for one-time setup fee" },
            { key: "APP_URL", desc: "Public app URL used for Stripe success/cancel redirects" },
          ].map((v) => (
            <div key={v.key} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
              <code className="text-xs bg-slate-100 px-2 py-1 rounded font-bold text-slate-700 shrink-0">{v.key}</code>
              <span className="text-xs text-slate-500">{v.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────

export default function DashboardPage() {
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<"overview" | "leads" | "settings">("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [industryBreakdown, setIndustryBreakdown] = useState<IndustryCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("latchly-dash-auth")) setAuthed(true);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, leadsRes] = await Promise.all([
        fetch("/api/dashboard/stats"),
        fetch("/api/leads"),
      ]);
      const statsData = await statsRes.json();
      const leadsData = await leadsRes.json();
      setStats(statsData.stats);
      setIndustryBreakdown(statsData.industryBreakdown || []);
      setLeads(leadsData.leads || []);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (authed) fetchData(); }, [authed, fetchData]);

  if (!authed) return <AuthGate onAuth={() => setAuthed(true)} />;

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: <BarChart3 size={16} /> },
    { id: "leads" as const, label: "Leads", icon: <List size={16} /> },
    { id: "settings" as const, label: "Settings", icon: <Settings size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-sky-500 flex items-center justify-center text-white text-xs font-bold">L</div>
          <span className="font-extrabold text-lg">Dashboard</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} disabled={loading}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors disabled:opacity-50">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={() => { sessionStorage.removeItem("latchly-dash-auth"); setAuthed(false); }}
            className="text-xs font-semibold text-slate-500 hover:text-red-500 transition-colors px-3 py-2">Logout</button>
        </div>
      </header>

      <div className="bg-white border-b border-slate-100 px-6 flex gap-1">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.id ? "border-brand text-brand" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}>
            {t.icon} {t.label}
            {t.id === "leads" && leads.length > 0 && (
              <span className="text-[10px] bg-brand/10 text-brand px-1.5 py-0.5 rounded-full font-bold">{leads.length}</span>
            )}
          </button>
        ))}
      </div>

      <main className="max-w-5xl mx-auto p-6">
        {tab === "overview" && <OverviewTab stats={stats} industryBreakdown={industryBreakdown} loading={loading} />}
        {tab === "leads" && <LeadsTab leads={leads} loading={loading} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />}
        {tab === "settings" && <SettingsTab />}
      </main>
    </div>
  );
}
