"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users, BarChart3, RefreshCw, Lock, Eye, EyeOff,
  Search, ChevronDown, Phone, Mail, ExternalLink,
  AlertTriangle, TrendingUp, Globe, ShieldAlert,
  ArrowRight, Zap, MessageSquare, MousePointer,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────

interface Prospect {
  id: number;
  business_name: string;
  owner_name: string;
  email: string;
  phone: string;
  niche: string;
  city: string;
  state: string;
  status: string;
  outreach_step: number;
  last_outreach_at: string;
  closer_responses: number;
  escalated: boolean;
  unsubscribed: boolean;
  bounce_type: string | null;
  bounced_at: string | null;
  demo_slug: string;
  demo_url: string;
  chatbot_score: number;
  redesign_score: number;
  combined_score: number;
  created_at: string;
  updated_at: string;
}

interface PipelineData {
  pipeline: { status: string; count: number }[];
  bounces: {
    totalUnsubscribed: number;
    hardBounces: number;
    spamComplaints: number;
    deliveryErrors: number;
    totalWithEmail: number;
  };
  outreach: {
    step0Sent: number;
    step1Sent: number;
    step2Sent: number;
    gotReplies: number;
    escalated: number;
  };
  demos: {
    totalDemos: number;
    totalVisits: number;
    leadCaptures: number;
  };
  topDemos: {
    demo_slug: string;
    visit_count: number;
    last_visit: string;
    business_name: string;
    owner_name: string;
    status: string;
    outreach_step: number;
  }[];
  prospects: Prospect[];
  nicheBreakdown: { niche: string; count: number }[];
}

// ── Auth Gate ───────────────────────────────────────────────────

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
      sessionStorage.setItem("latchly-pipeline-auth", "1");
      onAuth();
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-5">
      <div className="bg-[#1e293b] rounded-2xl border border-slate-700 p-8 w-full max-w-sm">
        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-5 mx-auto">
          <Lock size={22} />
        </div>
        <h1 className="text-xl font-bold text-center mb-1 text-white">Pipeline Admin</h1>
        <p className="text-sm text-slate-400 text-center mb-6">Enter your dashboard password</p>
        <form onSubmit={submit}>
          <div className="relative mb-4">
            <input type={showPw ? "text" : "password"} value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="Password"
              className="w-full px-4 py-3 pr-10 rounded-xl bg-[#0f172a] border border-slate-600 text-sm text-white outline-none focus:border-emerald-500/50" autoFocus />
            <button type="button" onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
          <button type="submit" disabled={loading || !password}
            className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm disabled:opacity-50 hover:bg-emerald-500 transition-colors">
            {loading ? "Checking..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Pipeline Funnel ─────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  scouted: { label: "Scouted", color: "text-slate-400", bg: "bg-slate-400/10" },
  audited: { label: "Audited", color: "text-blue-400", bg: "bg-blue-400/10" },
  outreach: { label: "Outreach", color: "text-amber-400", bg: "bg-amber-400/10" },
  closer: { label: "Closer", color: "text-purple-400", bg: "bg-purple-400/10" },
  closed: { label: "Closed", color: "text-emerald-400", bg: "bg-emerald-400/10" },
};

function PipelineFunnel({ pipeline }: { pipeline: { status: string; count: number }[] }) {
  const total = pipeline.reduce((s, p) => s + Number(p.count), 0);
  const stages = ["scouted", "audited", "outreach", "closer", "closed"];

  return (
    <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 p-6">
      <h3 className="text-sm font-bold text-slate-300 mb-5 flex items-center gap-2">
        <TrendingUp size={16} className="text-emerald-400" /> Pipeline Funnel
      </h3>
      <div className="flex items-center gap-2">
        {stages.map((stage, i) => {
          const entry = pipeline.find(p => p.status === stage);
          const count = Number(entry?.count || 0);
          const cfg = STATUS_CONFIG[stage] || { label: stage, color: "text-slate-400", bg: "bg-slate-400/10" };
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;

          return (
            <div key={stage} className="flex items-center gap-2 flex-1">
              <div className={`${cfg.bg} rounded-lg p-4 flex-1 text-center`}>
                <div className={`text-2xl font-black ${cfg.color}`}>{count}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">{cfg.label}</div>
                <div className="text-[10px] text-slate-600 mt-0.5">{pct}%</div>
              </div>
              {i < stages.length - 1 && (
                <ArrowRight size={14} className="text-slate-600 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Stat Cards ──────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 p-5">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>{icon}</div>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-black text-white">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

// ── Bounce Health ───────────────────────────────────────────────

function BounceHealth({ bounces }: { bounces: PipelineData["bounces"] }) {
  const bounceRate = bounces.totalWithEmail > 0
    ? ((bounces.totalUnsubscribed / bounces.totalWithEmail) * 100).toFixed(1)
    : "0.0";
  const isHealthy = Number(bounceRate) < 2;

  return (
    <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 p-6">
      <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
        <ShieldAlert size={16} className={isHealthy ? "text-emerald-400" : "text-red-400"} />
        Sender Reputation
      </h3>
      <div className="flex items-center gap-4 mb-4">
        <div className={`text-3xl font-black ${isHealthy ? "text-emerald-400" : "text-red-400"}`}>
          {bounceRate}%
        </div>
        <div className="text-xs text-slate-500">
          bounce rate<br />
          <span className={isHealthy ? "text-emerald-400" : "text-red-400"}>
            {isHealthy ? "Healthy" : "At risk"}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#0f172a] rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-red-400">{bounces.hardBounces}</div>
          <div className="text-[10px] text-slate-500 font-semibold">Hard bounces</div>
        </div>
        <div className="bg-[#0f172a] rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-orange-400">{bounces.spamComplaints}</div>
          <div className="text-[10px] text-slate-500 font-semibold">Spam reports</div>
        </div>
        <div className="bg-[#0f172a] rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-amber-400">{bounces.deliveryErrors}</div>
          <div className="text-[10px] text-slate-500 font-semibold">Delivery errors</div>
        </div>
      </div>
    </div>
  );
}

// ── Top Engaged Demos ───────────────────────────────────────────

function TopDemos({ topDemos }: { topDemos: PipelineData["topDemos"] }) {
  return (
    <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 p-6">
      <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
        <MousePointer size={16} className="text-blue-400" /> Top Engaged Demos
      </h3>
      <div className="space-y-2">
        {topDemos.slice(0, 10).map((d) => (
          <div key={d.demo_slug} className="flex items-center gap-3 bg-[#0f172a] rounded-lg px-4 py-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{d.business_name || d.demo_slug}</div>
              <div className="text-xs text-slate-500">{d.owner_name || "Unknown owner"}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-bold text-blue-400">{d.visit_count} visits</div>
              <div className="text-[10px] text-slate-500">
                {d.last_visit ? new Date(d.last_visit).toLocaleDateString() : "—"}
              </div>
            </div>
            <a href={`/demo/${d.demo_slug}`} target="_blank" rel="noopener noreferrer"
              className="text-slate-500 hover:text-blue-400 transition-colors">
              <ExternalLink size={14} />
            </a>
          </div>
        ))}
        {topDemos.length === 0 && (
          <div className="text-center py-8 text-slate-500 text-sm">No demo visits yet</div>
        )}
      </div>
    </div>
  );
}

// ── Prospect Table ──────────────────────────────────────────────

function statusBadge(status: string) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: "text-slate-400", bg: "bg-slate-400/10" };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function stepLabel(step: number) {
  if (step === 0) return <span className="text-slate-500">Not sent</span>;
  if (step === 1) return <span className="text-amber-400">Day 0 sent</span>;
  if (step === 2) return <span className="text-orange-400">Day 3 sent</span>;
  if (step >= 3) return <span className="text-emerald-400">Sequence done</span>;
  return <span className="text-slate-500">—</span>;
}

function ProspectTable({ prospects, searchQuery, setSearchQuery }: {
  prospects: Prospect[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = prospects.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.business_name?.toLowerCase().includes(q) ||
      p.owner_name?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.city?.toLowerCase().includes(q) ||
      p.niche?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, business, email, city, niche..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0f172a] border border-slate-700 text-sm text-white outline-none focus:border-emerald-500/50 placeholder-slate-500" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-[#0f172a] border border-slate-700 text-sm text-white outline-none">
          <option value="all">All statuses</option>
          <option value="scouted">Scouted</option>
          <option value="audited">Audited</option>
          <option value="outreach">Outreach</option>
          <option value="closer">Closer</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      <div className="text-xs text-slate-500 font-semibold">{filtered.length} prospects</div>

      <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_0.8fr_0.8fr] gap-2 px-5 py-3 bg-[#0f172a] text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          <div>Business</div>
          <div>Location</div>
          <div>Status</div>
          <div>Outreach</div>
          <div>Score</div>
          <div>Replies</div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">No prospects match</div>
        ) : (
          filtered.map((p) => (
            <div key={p.id}>
              <button onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                className="w-full grid grid-cols-[2fr_1fr_1fr_1fr_0.8fr_0.8fr] gap-2 px-5 py-3.5 border-t border-slate-700/30 text-left hover:bg-[#0f172a]/50 transition-colors items-center cursor-pointer">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{p.business_name}</div>
                  <div className="text-xs text-slate-500 truncate">
                    {p.owner_name || "Unknown"} {p.email && `· ${p.email}`}
                    {p.unsubscribed && <span className="ml-1 text-red-400 font-bold">[UNSUB]</span>}
                    {p.bounce_type && <span className="ml-1 text-red-400 font-bold">[{p.bounce_type.toUpperCase()}]</span>}
                  </div>
                </div>
                <div className="text-xs text-slate-400">{[p.city, p.state].filter(Boolean).join(", ") || "—"}</div>
                <div>{statusBadge(p.status)}</div>
                <div className="text-xs">{stepLabel(p.outreach_step || 0)}</div>
                <div>
                  <span className={`text-sm font-bold ${(p.combined_score || 0) >= 7 ? "text-emerald-400" : (p.combined_score || 0) >= 4 ? "text-amber-400" : "text-slate-500"}`}>
                    {p.combined_score ?? "—"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-purple-400">{p.closer_responses || 0}</span>
                  {p.escalated && <Zap size={12} className="text-amber-400" />}
                  <ChevronDown size={14} className={`text-slate-500 ml-auto transition-transform ${expanded === p.id ? "rotate-180" : ""}`} />
                </div>
              </button>

              {expanded === p.id && (
                <div className="px-5 py-4 border-t border-slate-700/30 bg-[#0f172a]/80">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500 font-semibold block mb-1">Niche</span>
                      <span className="text-white capitalize">{p.niche || "—"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-semibold block mb-1">Chatbot Score</span>
                      <span className="text-white">{p.chatbot_score ?? "—"}/10</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-semibold block mb-1">Redesign Score</span>
                      <span className="text-white">{p.redesign_score ?? "—"}/10</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-semibold block mb-1">Last Outreach</span>
                      <span className="text-white">
                        {p.last_outreach_at ? new Date(p.last_outreach_at).toLocaleDateString() : "Never"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-semibold block mb-1">Created</span>
                      <span className="text-white">{new Date(p.created_at).toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-semibold block mb-1">Escalated</span>
                      <span className={p.escalated ? "text-amber-400 font-bold" : "text-slate-500"}>
                        {p.escalated ? "Yes" : "No"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-semibold block mb-1">Bounce</span>
                      <span className={p.bounce_type ? "text-red-400 font-bold" : "text-slate-500"}>
                        {p.bounce_type || "Clean"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-semibold block mb-1">Demo</span>
                      {p.demo_slug ? (
                        <a href={`/demo/${p.demo_slug}`} target="_blank" rel="noopener noreferrer"
                          className="text-blue-400 hover:underline flex items-center gap-1">
                          View <ExternalLink size={10} />
                        </a>
                      ) : (
                        <span className="text-slate-500">None</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    {p.phone && (
                      <a href={`tel:${p.phone}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500">
                        <Phone size={12} /> Call
                      </a>
                    )}
                    {p.email && !p.unsubscribed && (
                      <a href={`mailto:${p.email}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-600 text-white text-xs font-bold hover:bg-slate-500">
                        <Mail size={12} /> Email
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────

export default function PipelineDashboard() {
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "prospects" | "demos">("overview");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("latchly-pipeline-auth")) setAuthed(true);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/pipeline");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Pipeline fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (authed) fetchData(); }, [authed, fetchData]);

  if (!authed) return <AuthGate onAuth={() => setAuthed(true)} />;

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: <BarChart3 size={16} /> },
    { id: "prospects" as const, label: "Prospects", icon: <Users size={16} /> },
    { id: "demos" as const, label: "Demos", icon: <Globe size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-[#0f172a]">
      {/* Header */}
      <header className="bg-[#1e293b] border-b border-slate-700/50 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold">L</div>
          <span className="font-extrabold text-lg text-white">Pipeline</span>
          <span className="text-xs text-slate-500 font-semibold px-2 py-0.5 bg-slate-700/50 rounded-md">Admin</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} disabled={loading}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-700 transition-colors disabled:opacity-50">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={() => { sessionStorage.removeItem("latchly-pipeline-auth"); setAuthed(false); }}
            className="text-xs font-semibold text-slate-500 hover:text-red-400 transition-colors px-3 py-2">
            Logout
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-[#1e293b] border-b border-slate-700/50 px-6 flex gap-1">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.id
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}>
            {t.icon} {t.label}
            {t.id === "prospects" && data?.prospects && (
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold">
                {data.prospects.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto p-6">
        {loading && !data ? (
          <div className="flex items-center justify-center py-24">
            <RefreshCw size={24} className="animate-spin text-slate-500" />
          </div>
        ) : !data ? (
          <div className="text-center py-24 text-slate-500">Failed to load data</div>
        ) : (
          <>
            {tab === "overview" && (
              <div className="space-y-6">
                {/* Pipeline Funnel */}
                <PipelineFunnel pipeline={data.pipeline} />

                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard
                    icon={<Mail size={16} className="text-amber-400" />}
                    label="Day 0 Sent" value={data.outreach.step0Sent}
                    sub="Initial cold emails" color="bg-amber-400/10"
                  />
                  <StatCard
                    icon={<MessageSquare size={16} className="text-purple-400" />}
                    label="Got Replies" value={data.outreach.gotReplies}
                    sub={`${data.outreach.escalated} escalated`} color="bg-purple-400/10"
                  />
                  <StatCard
                    icon={<MousePointer size={16} className="text-blue-400" />}
                    label="Demo Visits" value={data.demos.totalVisits}
                    sub={`${data.demos.totalDemos} unique demos`} color="bg-blue-400/10"
                  />
                  <StatCard
                    icon={<Zap size={16} className="text-emerald-400" />}
                    label="Leads Captured" value={data.demos.leadCaptures}
                    sub="From demo chat widgets" color="bg-emerald-400/10"
                  />
                </div>

                {/* Bounce Health + Niche */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <BounceHealth bounces={data.bounces} />

                  <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 p-6">
                    <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                      <BarChart3 size={16} className="text-amber-400" /> By Niche
                    </h3>
                    <div className="space-y-3">
                      {data.nicheBreakdown.map((n) => {
                        const max = Math.max(...data.nicheBreakdown.map(x => Number(x.count)));
                        const pct = max > 0 ? (Number(n.count) / max) * 100 : 0;
                        return (
                          <div key={n.niche} className="flex items-center gap-3">
                            <span className="text-xs font-semibold text-slate-400 w-20 capitalize">{n.niche}</span>
                            <div className="flex-1 bg-[#0f172a] rounded-full h-2.5 overflow-hidden">
                              <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs font-bold text-white w-8 text-right">{n.count}</span>
                          </div>
                        );
                      })}
                      {data.nicheBreakdown.length === 0 && (
                        <div className="text-center py-4 text-slate-500 text-sm">No niche data</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Outreach Drip Funnel */}
                <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 p-6">
                  <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                    <Mail size={16} className="text-blue-400" /> Outreach Drip Funnel
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-[#0f172a] rounded-lg p-4 text-center">
                      <div className="text-2xl font-black text-amber-400">{data.outreach.step0Sent}</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase mt-1">Day 0 — Initial</div>
                    </div>
                    <div className="bg-[#0f172a] rounded-lg p-4 text-center">
                      <div className="text-2xl font-black text-orange-400">{data.outreach.step1Sent}</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase mt-1">Day 3 — Follow-up</div>
                    </div>
                    <div className="bg-[#0f172a] rounded-lg p-4 text-center">
                      <div className="text-2xl font-black text-red-400">{data.outreach.step2Sent}</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase mt-1">Day 7 — Final</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === "prospects" && (
              <ProspectTable
                prospects={data.prospects}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
              />
            )}

            {tab === "demos" && (
              <TopDemos topDemos={data.topDemos} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
