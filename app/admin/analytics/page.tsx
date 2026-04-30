"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Ban,
  BarChart3,
  ChevronRight,
  Eye,
  Info,
  Loader2,
  MailCheck,
  MousePointerClick,
  RefreshCw,
  Reply,
  Search,
  Send,
} from "lucide-react";
import { AuthGate, isClientAuthed } from "@/components/admin/auth-gate";
import { EngagementTimeline, type EngagementEvent } from "@/components/admin/engagement-timeline";
import { formatDateTime } from "@/components/admin/lead-helpers";
import { StatTile } from "@/components/admin/stat-tile";

interface AnalyticsData {
  range: { startsAt: string; endsAt: string; days: number };
  totals: {
    sent: number;
    delivered: number;
    openedUnique: number;
    openedTotal: number;
    clickedUnique: number;
    clickedTotal: number;
    bounced: number;
    complained: number;
    unsubscribed: number;
    replied: number;
  };
  daily: { day: string; sent: number; opened: number; clicked: number; openRate: number }[];
  topLeads: { leadId: number; businessName: string; ownerName: string | null; openCount: number; clickCount: number; lastEventAt: string }[];
  hot24h: { leadId: number; businessName: string; ownerName: string | null; lastEventType: string; lastEventAt: string }[];
  leadRows: {
    leadId: number;
    businessName: string;
    ownerName: string | null;
    email: string | null;
    sentCount: number;
    deliveredCount: number;
    openCount: number;
    clickCount: number;
    bouncedCount: number;
    complainedCount: number;
    repliedCount: number;
    lastEventAt: string;
  }[];
  events?: EngagementEvent[];
}

export default function AnalyticsPage() {
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [range, setRange] = useState("14d");
  const [query, setQuery] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);

  useEffect(() => {
    setAuthed(isClientAuthed());
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const lid = Number(params.get("leadId") || "");
    if (Number.isFinite(lid) && lid > 0) setSelectedLeadId(lid);
    const r = params.get("range");
    if (r === "7d" || r === "14d" || r === "30d" || r === "90d") setRange(r);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (selectedLeadId) params.set("leadId", String(selectedLeadId)); else params.delete("leadId");
    if (range === "14d") params.delete("range"); else params.set("range", range);
    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState(null, "", next);
  }, [range, selectedLeadId]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ range });
      if (selectedLeadId) params.set("leadId", String(selectedLeadId));
      const res = await fetch(`/api/admin/analytics/engagement?${params.toString()}`);
      const json = await res.json();
      if (res.status === 401) { setAuthed(false); return; }
      if (!res.ok) throw new Error(json.error || "Failed to load analytics");
      setData(json);
    } catch (err: any) {
      setError(err.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [range, selectedLeadId]);

  useEffect(() => { if (authed) fetchData(); }, [authed, fetchData]);

  const selectedLead = useMemo(() => {
    return data?.leadRows.find((lead) => lead.leadId === selectedLeadId) || null;
  }, [data?.leadRows, selectedLeadId]);

  const filteredLeadRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = data?.leadRows || [];
    if (!q) return rows;
    return rows.filter((lead) => [
      lead.businessName,
      lead.ownerName || "",
      lead.email || "",
    ].join(" ").toLowerCase().includes(q));
  }, [data?.leadRows, query]);

  if (!authed) return <AuthGate onAuth={() => setAuthed(true)} title="Analytics" />;

  const totals = data?.totals;
  const hasEvents = Boolean(totals && Object.values(totals).some((value) => value > 0));

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <BarChart3 size={18} />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-black text-slate-950 leading-tight">Email Analytics</h1>
              <p className="text-xs text-slate-500 leading-tight">
                Opens, delivery health, and per-lead recipient activity
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={range}
              onChange={(event) => setRange(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="7d">7 days</option>
              <option value="14d">14 days</option>
              <option value="30d">30 days</option>
              <option value="90d">90 days</option>
            </select>
            <button
              onClick={fetchData}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto px-4 sm:px-6 py-5 space-y-5">
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {error}
          </div>
        )}

        {!data && loading ? (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-12 text-center text-sm font-semibold text-slate-500">
            <Loader2 size={18} className="mx-auto mb-2 animate-spin" /> Loading analytics...
          </div>
        ) : data && !hasEvents ? (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">
            No engagement events yet. Open tracking activates after HTML outreach deploy + first cold email.
          </div>
        ) : data && totals ? (
          <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatTile icon={<Send size={15} />} label={`Sent (${data.range.days}d)`} value={totals.sent} />
              <StatTile icon={<MailCheck size={15} />} label="Delivered" value={totals.delivered} sub={`${pct(totals.delivered, totals.sent)}% of sent`} tone="text-emerald-600" />
              <StatTile icon={<Eye size={15} />} label="Opened" value={totals.openedUnique} sub={`${totals.openedTotal} total opens`} tone="text-teal-600" />
              <StatTile icon={<Info size={15} />} label="Open rate" value={`${pct(totals.openedUnique, totals.sent)}%`} sub="Excludes opens <5m after send" tone="text-blue-600" />
              <StatTile icon={<MousePointerClick size={15} />} label="Clicked" value={totals.clickedUnique} sub={`${totals.clickedTotal} total clicks`} tone="text-violet-600" />
              <StatTile icon={<Activity size={15} />} label="Click rate" value={`${pct(totals.clickedUnique, totals.sent)}%`} sub="Usually 0 while click tracking is off" tone="text-violet-600" />
              <StatTile icon={<AlertTriangle size={15} />} label="Bounced" value={totals.bounced} sub={`${pct(totals.bounced, totals.sent)}% of sent`} tone="text-rose-600" />
              <StatTile icon={<Ban size={15} />} label="Complained / Unsub" value={totals.complained + totals.unsubscribed} sub={`${totals.complained} complaints · ${totals.unsubscribed} unsub`} tone="text-red-600" />
            </section>

            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900 flex items-start gap-2">
              <Info size={14} className="mt-0.5 shrink-0" />
              <span>
                Opens exclude events within five minutes of send to reduce Apple Mail Privacy Protection prefetch noise, so this dashboard can differ from Resend raw open counts.
              </span>
            </div>

            <section className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-sm font-black text-slate-950">Daily trend</h2>
                  <p className="text-xs text-slate-500">Sent, opened, clicked, and guarded open-rate</p>
                </div>
              </div>
              <TrendChart rows={data.daily} />
            </section>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <LeadPanel
                title="Most engaged leads"
                empty="No guarded opens or clicks in this range."
                rows={data.topLeads.map((lead) => ({
                  leadId: lead.leadId,
                  title: lead.businessName,
                  subtitle: lead.ownerName || "No owner",
                  metric: `${lead.openCount} opens`,
                  subMetric: `${lead.clickCount} clicks`,
                  at: lead.lastEventAt,
                }))}
                onSelect={setSelectedLeadId}
              />
              <LeadPanel
                title="Hot in last 24h"
                empty="No recipient activity in the last 24 hours."
                rows={data.hot24h.map((lead) => ({
                  leadId: lead.leadId,
                  title: lead.businessName,
                  subtitle: lead.ownerName || "No owner",
                  metric: eventLabel(lead.lastEventType),
                  subMetric: "",
                  at: lead.lastEventAt,
                }))}
                onSelect={setSelectedLeadId}
              />
            </div>

            <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_430px] gap-5 items-start">
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden min-w-0">
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-black text-slate-950">Per-lead explorer</h2>
                    <p className="text-xs text-slate-500">Search rows with engagement in the selected range</p>
                  </div>
                  <div className="relative min-w-[220px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search business, owner, email"
                      className="w-full rounded-md border border-slate-200 pl-9 pr-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {filteredLeadRows.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-500">No matching engaged leads</div>
                ) : (
                  filteredLeadRows.map((lead) => (
                    <button
                      key={lead.leadId}
                      type="button"
                      onClick={() => setSelectedLeadId(lead.leadId)}
                      className={`w-full text-left px-4 py-3 border-t border-slate-100 hover:bg-slate-50 transition-colors ${
                        selectedLeadId === lead.leadId ? "bg-blue-50/70" : "bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-slate-950 truncate">{lead.businessName}</div>
                          <div className="text-xs text-slate-500 truncate">
                            {[lead.ownerName, lead.email].filter(Boolean).join(" · ") || "No contact"}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            <Chip tone="emerald">{lead.openCount} opens</Chip>
                            <Chip tone="violet">{lead.clickCount} clicks</Chip>
                            {lead.repliedCount > 0 && <Chip tone="amber">{lead.repliedCount} replies</Chip>}
                            {lead.bouncedCount > 0 && <Chip tone="rose">{lead.bouncedCount} bounced</Chip>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[11px] font-semibold text-slate-500">{formatDateTime(lead.lastEventAt)}</div>
                          <ChevronRight size={15} className="ml-auto mt-1 text-slate-400" />
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>

              <aside className="bg-white border border-slate-200 rounded-lg p-4 sticky top-24">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <h2 className="text-sm font-black text-slate-950">Event timeline</h2>
                    <p className="text-xs text-slate-500 truncate">
                      {selectedLead ? selectedLead.businessName : selectedLeadId ? `Lead ${selectedLeadId}` : "Select a lead"}
                    </p>
                  </div>
                  {selectedLeadId && (
                    <a
                      href={`/admin/cold-email?leadId=${selectedLeadId}&tab=sent`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Cold Email <ChevronRight size={12} />
                    </a>
                  )}
                </div>
                {selectedLeadId ? (
                  <EngagementTimeline
                    events={data.events || []}
                    emptyText="No engagement yet — opens land here within ~30s of recipient view."
                  />
                ) : (
                  <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-4 text-xs text-slate-500">
                    Select a lead to inspect the full event stream.
                  </div>
                )}
              </aside>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

function pct(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

function TrendChart({ rows }: { rows: AnalyticsData["daily"] }) {
  const width = Math.max(560, rows.length * 42);
  const height = 230;
  const chartTop = 18;
  const chartBottom = 184;
  const maxCount = Math.max(1, ...rows.map((row) => row.sent + row.opened + row.clicked));
  const barWidth = Math.max(12, Math.min(24, width / Math.max(rows.length, 1) - 16));
  const step = width / Math.max(rows.length, 1);
  const linePoints = rows.map((row, index) => {
    const x = step * index + step / 2;
    const y = chartBottom - (Math.min(row.openRate, 100) / 100) * (chartBottom - chartTop);
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-full h-[230px]" role="img" aria-label="Email engagement trend">
        <line x1="0" y1={chartBottom} x2={width} y2={chartBottom} stroke="#e2e8f0" />
        {[25, 50, 75, 100].map((tick) => {
          const y = chartBottom - (tick / 100) * (chartBottom - chartTop);
          return <line key={tick} x1="0" y1={y} x2={width} y2={y} stroke="#f1f5f9" />;
        })}
        {rows.map((row, index) => {
          const x = step * index + step / 2 - barWidth / 2;
          const sentH = (row.sent / maxCount) * (chartBottom - chartTop);
          const openH = (row.opened / maxCount) * (chartBottom - chartTop);
          const clickH = (row.clicked / maxCount) * (chartBottom - chartTop);
          const label = new Date(`${row.day}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
          return (
            <g key={row.day}>
              <rect x={x} y={chartBottom - sentH} width={barWidth} height={sentH} rx="3" fill="#93c5fd" />
              <rect x={x} y={chartBottom - sentH - openH} width={barWidth} height={openH} rx="3" fill="#2dd4bf" />
              <rect x={x} y={chartBottom - sentH - openH - clickH} width={barWidth} height={clickH} rx="3" fill="#a78bfa" />
              <text x={step * index + step / 2} y="210" textAnchor="middle" fontSize="10" fill="#64748b">{label}</text>
            </g>
          );
        })}
        {linePoints && <polyline points={linePoints} fill="none" stroke="#0f172a" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
        {rows.map((row, index) => {
          const x = step * index + step / 2;
          const y = chartBottom - (Math.min(row.openRate, 100) / 100) * (chartBottom - chartTop);
          return <circle key={`${row.day}-rate`} cx={x} cy={y} r="3" fill="#0f172a" />;
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-bold text-slate-600">
        <Legend color="bg-blue-300" label="Sent" />
        <Legend color="bg-teal-400" label="Opened" />
        <Legend color="bg-violet-400" label="Clicked" />
        <Legend color="bg-slate-900" label="Open-rate line" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function LeadPanel({
  title,
  empty,
  rows,
  onSelect,
}: {
  title: string;
  empty: string;
  rows: { leadId: number; title: string; subtitle: string; metric: string; subMetric: string; at: string }[];
  onSelect: (leadId: number) => void;
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <h2 className="text-sm font-black text-slate-950">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-8 text-sm text-slate-500">{empty}</div>
      ) : rows.map((row) => (
        <button
          key={`${title}-${row.leadId}`}
          type="button"
          onClick={() => onSelect(row.leadId)}
          className="w-full text-left px-4 py-3 border-t border-slate-100 first:border-t-0 hover:bg-slate-50"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-950 truncate">{row.title}</div>
              <div className="text-xs text-slate-500 truncate">{row.subtitle}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs font-black text-slate-900">{row.metric}</div>
              {row.subMetric && <div className="text-[11px] text-slate-500">{row.subMetric}</div>}
              <div className="text-[10px] text-slate-400">{formatDateTime(row.at)}</div>
            </div>
          </div>
        </button>
      ))}
    </section>
  );
}

function Chip({ tone, children }: { tone: "emerald" | "violet" | "amber" | "rose"; children: React.ReactNode }) {
  const classes = {
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
    violet: "border-violet-100 bg-violet-50 text-violet-700",
    amber: "border-amber-100 bg-amber-50 text-amber-800",
    rose: "border-rose-100 bg-rose-50 text-rose-700",
  };
  return (
    <span className={`inline-flex border px-1.5 py-0.5 rounded-md text-[10px] font-bold ${classes[tone]}`}>
      {children}
    </span>
  );
}

function eventLabel(eventType: string) {
  switch (eventType) {
    case "opened": return "opened";
    case "clicked": return "clicked";
    case "replied": return "replied";
    case "bounced": return "bounced";
    case "complained": return "complaint";
    case "unsubscribed": return "unsub";
    default: return eventType;
  }
}
