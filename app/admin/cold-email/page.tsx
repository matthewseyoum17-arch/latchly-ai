"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  Filter,
  Inbox,
  Loader2,
  RefreshCw,
  Rocket,
  Search,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { AuthGate, isClientAuthed } from "@/components/admin/auth-gate";
import { StatPill } from "@/components/admin/stat-tile";
import {
  formatDateTime,
  groupByDay,
  outreachStatusTone,
  qualityChipTone,
  timeUntil,
} from "@/components/admin/lead-helpers";
import type { CrmData, Lead, OutreachStats } from "@/components/admin/types";

type GroupKey = "draft" | "queued" | "sending" | "sent_today" | "day_zero_sent" | "day_zero_failed" | "rejected" | "unsubscribed";

const GROUP_META: { key: GroupKey; label: string; description: string; tone: string; icon: React.ReactNode; outreachStatus: string }[] = [
  { key: "draft",          label: "Pending QA",         description: "Awaiting your approval before they queue for send",            tone: "border-violet-200 bg-violet-50",   icon: <ShieldCheck size={14} />, outreachStatus: "draft" },
  { key: "queued",         label: "Queued",             description: "Approved · waiting for the next 7-9am-local send window",     tone: "border-blue-200 bg-blue-50",        icon: <Inbox size={14} />,       outreachStatus: "queued" },
  { key: "sending",        label: "Sending",            description: "Drain cron has the row in flight right now",                  tone: "border-amber-200 bg-amber-50",      icon: <Send size={14} />,        outreachStatus: "sending" },
  { key: "sent_today",     label: "Sent today",         description: "Confirmed deliveries since midnight",                          tone: "border-emerald-200 bg-emerald-50",  icon: <Check size={14} />,       outreachStatus: "sent_today" },
  { key: "day_zero_sent",  label: "Sent (recent)",      description: "Day-0 emails delivered prior to today",                        tone: "border-emerald-100 bg-emerald-50/50", icon: <Check size={14} />,    outreachStatus: "day_zero_sent" },
  { key: "day_zero_failed",label: "Failed",             description: "Resend errored — investigate, then retry via Send now",        tone: "border-rose-200 bg-rose-50",        icon: <AlertTriangle size={14} />, outreachStatus: "day_zero_failed" },
  { key: "rejected",       label: "Rejected drafts",    description: "Marked unfit during QA. Kept for learning.",                   tone: "border-zinc-200 bg-zinc-50",        icon: <X size={14} />,           outreachStatus: "rejected" },
  { key: "unsubscribed",   label: "Unsubscribed",       description: "Recipients who opted out — never re-contact",                  tone: "border-zinc-200 bg-zinc-50",        icon: <X size={14} />,           outreachStatus: "unsubscribed" },
];

export default function ColdEmailPage() {
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState<CrmData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<GroupKey | "all">("all");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<GroupKey>>(
    () => new Set<GroupKey>(["day_zero_sent", "rejected", "unsubscribed"]),
  );
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [outreachActionId, setOutreachActionId] = useState<number | null>(null);
  const [sendNowId, setSendNowId] = useState<number | null>(null);

  useEffect(() => {
    setAuthed(isClientAuthed());
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const lid = Number(params.get("leadId") || "");
      if (Number.isFinite(lid) && lid > 0) setSelectedId(lid);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        q: query,
        limit: "200",
      });
      // Pull every lead that has any outreach state attached. The /api accepts
      // outreachStatus=active for the union (draft|queued|sending|failed),
      // but for the inbox we want sent + rejected + unsub too — so we just
      // fetch a large window and bucket client-side.
      params.set("includeArchived", "1");
      const res = await fetch(`/api/admin/latchly-leads?${params.toString()}`);
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setData(json);
    } catch (err: any) {
      setError(err.message || "Failed to load outreach inbox");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    if (authed) fetchData();
  }, [authed, fetchData]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const grouped = useMemo(() => {
    const buckets: Record<GroupKey, Lead[]> = {
      draft: [], queued: [], sending: [], sent_today: [],
      day_zero_sent: [], day_zero_failed: [], rejected: [], unsubscribed: [],
    };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    for (const lead of data?.leads || []) {
      const status = lead.outreachStatus || "none";
      if (status === "draft") buckets.draft.push(lead);
      else if (status === "queued") buckets.queued.push(lead);
      else if (status === "sending") buckets.sending.push(lead);
      else if (status === "day_zero_sent") {
        const sentMs = lead.emailSentAt ? new Date(lead.emailSentAt).getTime() : 0;
        if (sentMs >= todayMs) buckets.sent_today.push(lead);
        else buckets.day_zero_sent.push(lead);
      }
      else if (status === "day_zero_failed") buckets.day_zero_failed.push(lead);
      else if (status === "rejected") buckets.rejected.push(lead);
      else if (status === "unsubscribed") buckets.unsubscribed.push(lead);
    }
    return buckets;
  }, [data?.leads]);

  const outreachStats: OutreachStats = data?.stats.outreach || {
    draft: 0, queued: 0, sending: 0, sent: 0, sentToday: 0, failed: 0, rejected: 0, unsubscribed: 0,
  };

  const selectedLead = useMemo(() => {
    if (!data?.leads) return null;
    return data.leads.find(l => l.id === selectedId) || null;
  }, [data?.leads, selectedId]);

  const visibleGroups = useMemo(() => {
    const groups = activeGroup === "all" ? GROUP_META : GROUP_META.filter(g => g.key === activeGroup);
    return groups.map(group => ({
      ...group,
      rows: filterRows(grouped[group.key], query),
    }));
  }, [activeGroup, grouped, query]);

  const toggleCollapse = (key: GroupKey) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const approveOutreach = async (lead: Lead) => {
    setOutreachActionId(lead.id);
    try {
      const res = await fetch(`/api/admin/latchly-leads/${lead.id}/approve-outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Approve failed");
      setToast("Approved · queued for next send window");
      await fetchData();
    } catch (err: any) {
      setError(err.message || "Approve failed");
    } finally {
      setOutreachActionId(null);
    }
  };

  const rejectOutreach = async (lead: Lead) => {
    const reason = window.prompt("Reason for rejecting (optional):", "rejected_in_qa");
    if (reason === null) return;
    setOutreachActionId(lead.id);
    try {
      const res = await fetch(`/api/admin/latchly-leads/${lead.id}/reject-outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Reject failed");
      setToast("Rejected");
      await fetchData();
    } catch (err: any) {
      setError(err.message || "Reject failed");
    } finally {
      setOutreachActionId(null);
    }
  };

  const sendNow = async (lead: Lead) => {
    if (!window.confirm(`Send to ${lead.email} right now? Bypasses the 7-9am-local schedule.`)) return;
    setSendNowId(lead.id);
    try {
      const res = await fetch(`/api/admin/latchly-leads/${lead.id}/send-now`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Send failed");
      setToast(`Sent to ${lead.email}`);
      await fetchData();
    } catch (err: any) {
      setError(err.message || "Send failed");
    } finally {
      setSendNowId(null);
    }
  };

  if (!authed) return <AuthGate onAuth={() => setAuthed(true)} title="Cold Email" />;

  return (
    <div className="min-h-screen">
      {/* Page header */}
      <header className="sticky top-0 lg:top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
              <Rocket size={18} />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-black text-slate-950 leading-tight">Autonomous Cold Email</h1>
              <p className="text-xs text-slate-500 leading-tight">
                Drafts → QA approval → 7-9am local · drains every 15min Mon-Fri
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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

      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Stat strip */}
        <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <StatPill icon={<ShieldCheck size={14} />}    label="Drafts"      value={outreachStats.draft}        tone="text-violet-700" />
          <StatPill icon={<Inbox size={14} />}          label="Queued"      value={outreachStats.queued}       tone="text-blue-700" />
          <StatPill icon={<Send size={14} />}           label="Sending"     value={outreachStats.sending}      tone="text-amber-700" />
          <StatPill icon={<Clock size={14} />}          label="Sent today"  value={outreachStats.sentToday}    tone="text-emerald-700" />
          <StatPill icon={<Check size={14} />}          label="Sent total"  value={outreachStats.sent}         tone="text-emerald-700" />
          <StatPill icon={<AlertTriangle size={14} />}  label="Failed"      value={outreachStats.failed}       tone="text-rose-700" />
          <StatPill icon={<X size={14} />}              label="Rejected"    value={outreachStats.rejected}     tone="text-zinc-600" />
          <StatPill icon={<X size={14} />}              label="Unsub"       value={outreachStats.unsubscribed} tone="text-zinc-600" />
        </section>

        {/* Send-rate progress */}
        <section className="bg-white border border-slate-200 rounded-lg p-4">
          <SendRateBar sent={outreachStats.sentToday} cap={50} />
        </section>

        {/* Filter pills */}
        <section className="bg-white border border-slate-200 rounded-lg p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search business, owner, email"
              className="w-full rounded-md border border-slate-200 pl-9 pr-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </div>
          <button
            onClick={() => setActiveGroup("all")}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors ${activeGroup === "all" ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
          >
            <Filter size={13} /> All
          </button>
          {GROUP_META.map(group => (
            <button
              key={group.key}
              onClick={() => setActiveGroup(group.key)}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors ${activeGroup === group.key ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              {group.icon}
              {group.label}
              <span className={`ml-1 rounded-full px-1.5 text-[10px] ${activeGroup === group.key ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600"}`}>
                {grouped[group.key].length}
              </span>
            </button>
          ))}
        </section>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {error}
          </div>
        )}
        {toast && (
          <div className="rounded-lg border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800">
            {toast}
          </div>
        )}

        {/* Inbox + detail */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_440px] gap-5 items-start">
          <section className="space-y-4 min-w-0">
            {visibleGroups.map(group => {
              const collapsed = collapsedGroups.has(group.key);
              return (
                <GroupCard
                  key={group.key}
                  meta={group}
                  collapsed={collapsed}
                  onToggle={() => toggleCollapse(group.key)}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onApprove={approveOutreach}
                  onReject={rejectOutreach}
                  onSendNow={sendNow}
                  approveInFlightId={outreachActionId}
                  sendInFlightId={sendNowId}
                />
              );
            })}
            {!loading && visibleGroups.every(g => g.rows.length === 0) && (
              <div className="bg-white border border-dashed border-slate-200 rounded-lg p-12 text-center text-sm text-slate-500">
                Nothing in this view yet.
              </div>
            )}
          </section>

          <OutreachDetail
            lead={selectedLead}
            onApprove={approveOutreach}
            onReject={rejectOutreach}
            onSendNow={sendNow}
            approveInFlight={Boolean(selectedLead && outreachActionId === selectedLead.id)}
            sendInFlight={Boolean(selectedLead && sendNowId === selectedLead.id)}
          />
        </div>
      </div>
    </div>
  );
}

function filterRows(rows: Lead[], query: string): Lead[] {
  if (!query.trim()) return rows;
  const q = query.toLowerCase();
  return rows.filter(lead => {
    return (
      (lead.businessName || "").toLowerCase().includes(q)
      || (lead.email || "").toLowerCase().includes(q)
      || (lead.decisionMakerName || "").toLowerCase().includes(q)
      || (lead.city || "").toLowerCase().includes(q)
      || (lead.niche || "").toLowerCase().includes(q)
    );
  });
}

interface GroupCardProps {
  meta: typeof GROUP_META[number] & { rows: Lead[] };
  collapsed: boolean;
  onToggle: () => void;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onApprove: (lead: Lead) => void;
  onReject: (lead: Lead) => void;
  onSendNow: (lead: Lead) => void;
  approveInFlightId: number | null;
  sendInFlightId: number | null;
}

function GroupCard({ meta, collapsed, onToggle, selectedId, onSelect, onApprove, onReject, onSendNow, approveInFlightId, sendInFlightId }: GroupCardProps) {
  const showQueueGrouping = meta.key === "queued" && meta.rows.length > 0;
  const dayGroups = showQueueGrouping
    ? groupByDay(meta.rows, lead => lead.outreachScheduledFor || null)
    : null;

  return (
    <div className={`bg-white border rounded-lg overflow-hidden ${meta.tone}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-white/50 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-7 h-7 rounded-md bg-white/70 flex items-center justify-center text-slate-700 shrink-0">
            {meta.icon}
          </span>
          <div className="min-w-0 text-left">
            <div className="text-sm font-black text-slate-950">
              {meta.label}
              <span className="ml-2 text-slate-600 font-bold">{meta.rows.length}</span>
            </div>
            <div className="text-[11px] text-slate-600 truncate">{meta.description}</div>
          </div>
        </div>
        {collapsed ? <ChevronRight size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
      </button>
      {!collapsed && meta.rows.length > 0 && (
        <div className="border-t border-slate-200 bg-white">
          {dayGroups ? (
            dayGroups.map(day => (
              <div key={day.key}>
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  {day.label} · {day.items.length}
                </div>
                {day.items.map(lead => (
                  <OutreachRow
                    key={lead.id}
                    lead={lead}
                    selected={selectedId === lead.id}
                    onSelect={() => onSelect(lead.id)}
                    onApprove={onApprove}
                    onReject={onReject}
                    onSendNow={onSendNow}
                    approveInFlight={approveInFlightId === lead.id}
                    sendInFlight={sendInFlightId === lead.id}
                  />
                ))}
              </div>
            ))
          ) : (
            meta.rows.map(lead => (
              <OutreachRow
                key={lead.id}
                lead={lead}
                selected={selectedId === lead.id}
                onSelect={() => onSelect(lead.id)}
                onApprove={onApprove}
                onReject={onReject}
                onSendNow={onSendNow}
                approveInFlight={approveInFlightId === lead.id}
                sendInFlight={sendInFlightId === lead.id}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface OutreachRowProps {
  lead: Lead;
  selected: boolean;
  onSelect: () => void;
  onApprove: (lead: Lead) => void;
  onReject: (lead: Lead) => void;
  onSendNow: (lead: Lead) => void;
  approveInFlight: boolean;
  sendInFlight: boolean;
}

function OutreachRow({ lead, selected, onSelect, onApprove, onReject, onSendNow, approveInFlight, sendInFlight }: OutreachRowProps) {
  const status = lead.outreachStatus || "none";
  const showApprove = status === "draft";
  const showSendNow = status === "queued" || status === "day_zero_failed";
  const countdown = status === "queued" ? timeUntil(lead.outreachScheduledFor) : "";
  const sentAt = status === "day_zero_sent" ? formatDateTime(lead.emailSentAt) : "";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect(); }}
      className={`px-4 py-3 border-b border-slate-100 last:border-b-0 cursor-pointer transition-colors ${
        selected ? "bg-teal-50/70" : "bg-white hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-slate-950 truncate">{lead.businessName}</span>
            {typeof lead.demoQualityScore === "number" && (
              <span className={`inline-flex border px-1.5 py-0.5 rounded-md text-[10px] font-bold ${qualityChipTone(lead.demoQualityScore)}`}>
                {lead.demoQualityScore.toFixed(0)}/100
              </span>
            )}
            {lead.tier === "premium" && (
              <span className="inline-flex border border-red-200 bg-red-50 text-red-800 px-1.5 py-0.5 rounded-md text-[10px] font-bold">
                Premium
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-slate-700 truncate">
            {lead.emailSubject || <span className="text-slate-400 italic">No subject yet</span>}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 truncate">
            {lead.email || "no email"} · {lead.decisionMakerName || "no owner"}{lead.city ? ` · ${lead.city}` : ""}
          </div>
          {lead.outreachError && (
            <div className="mt-1 text-[11px] text-rose-700 truncate">
              ⚠ {lead.outreachError}
            </div>
          )}
        </div>
        <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
          <span className={`inline-flex border px-2 py-0.5 rounded-md text-[10px] font-bold ${outreachStatusTone(status)}`}>
            {status === "queued" && countdown ? countdown : status === "day_zero_sent" ? "sent" : status}
          </span>
          {sentAt && <span className="text-[10px] text-slate-500">{sentAt}</span>}
          <div className="flex gap-1.5">
            {showApprove && (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onApprove(lead); }}
                  disabled={approveInFlight}
                  className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                >
                  {approveInFlight ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                  Approve
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onReject(lead); }}
                  disabled={approveInFlight}
                  className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                >
                  <X size={11} /> Reject
                </button>
              </>
            )}
            {showSendNow && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onSendNow(lead); }}
                disabled={sendInFlight}
                className="inline-flex items-center gap-1 rounded-md bg-slate-950 px-2 py-1 text-[11px] font-bold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {sendInFlight ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                Send now
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface OutreachDetailProps {
  lead: Lead | null;
  onApprove: (lead: Lead) => void;
  onReject: (lead: Lead) => void;
  onSendNow: (lead: Lead) => void;
  approveInFlight: boolean;
  sendInFlight: boolean;
}

function OutreachDetail({ lead, onApprove, onReject, onSendNow, approveInFlight, sendInFlight }: OutreachDetailProps) {
  if (!lead) {
    return (
      <aside className="bg-white border border-slate-200 rounded-lg min-h-[420px] flex items-center justify-center text-sm text-slate-500 sticky top-24">
        Select an outreach row to inspect the full email.
      </aside>
    );
  }

  const status = lead.outreachStatus || "none";
  const showApprove = status === "draft";
  const showSendNow = status === "queued" || status === "day_zero_failed";

  return (
    <aside className="bg-white border border-slate-200 rounded-lg overflow-hidden sticky top-24 max-h-[calc(100vh-7rem)] flex flex-col">
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-black text-slate-950 leading-tight">{lead.businessName}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {[lead.city, lead.state].filter(Boolean).join(", ") || "—"} · {lead.niche || "—"}
            </p>
          </div>
          <span className={`shrink-0 inline-flex border px-2 py-1 rounded-md text-[11px] font-bold ${outreachStatusTone(status)}`}>
            {status}
          </span>
        </div>
        <div className="mt-2 text-xs text-slate-600">
          To <span className="font-mono text-slate-900">{lead.email || "—"}</span>
          {lead.decisionMakerName && <> · {lead.decisionMakerName}</>}
        </div>
      </div>

      <div className="p-5 space-y-4 overflow-y-auto">
        {lead.demoUrl && (
          <a
            href={lead.demoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-teal-700"
          >
            <ExternalLink size={12} /> Preview demo
          </a>
        )}

        {lead.emailSubject && (
          <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
            <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">Subject</div>
            <div className="text-sm font-semibold text-slate-900 break-words">{lead.emailSubject}</div>
          </div>
        )}

        {lead.emailBodyPreview && (
          <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
            <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">Body</div>
            <pre className="whitespace-pre-wrap text-xs text-slate-800 leading-5 font-sans">{lead.emailBodyPreview}</pre>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-xs">
          {lead.outreachScheduledFor && (
            <div className="rounded-md bg-slate-50 border border-slate-100 px-3 py-2">
              <div className="text-[10px] font-bold uppercase text-slate-500">Scheduled</div>
              <div className="font-semibold text-slate-900">{formatDateTime(lead.outreachScheduledFor)}</div>
            </div>
          )}
          {lead.emailSentAt && (
            <div className="rounded-md bg-emerald-50 border border-emerald-100 px-3 py-2">
              <div className="text-[10px] font-bold uppercase text-emerald-700">Sent</div>
              <div className="font-semibold text-emerald-900">{formatDateTime(lead.emailSentAt)}</div>
            </div>
          )}
          {lead.lastResendEmailId && (
            <div className="rounded-md bg-slate-50 border border-slate-100 px-3 py-2 col-span-2 truncate">
              <div className="text-[10px] font-bold uppercase text-slate-500">Resend ID</div>
              <div className="font-mono text-[11px] text-slate-700 truncate">{lead.lastResendEmailId}</div>
            </div>
          )}
          {lead.outreachError && (
            <div className="rounded-md bg-rose-50 border border-rose-100 px-3 py-2 col-span-2">
              <div className="text-[10px] font-bold uppercase text-rose-700">Error</div>
              <div className="text-[11px] text-rose-900 break-words">{lead.outreachError}</div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
          {showApprove && (
            <>
              <button
                type="button"
                onClick={() => onApprove(lead)}
                disabled={approveInFlight}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
              >
                {approveInFlight ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Approve
              </button>
              <button
                type="button"
                onClick={() => onReject(lead)}
                disabled={approveInFlight}
                className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
              >
                <X size={14} /> Reject
              </button>
            </>
          )}
          {showSendNow && (
            <button
              type="button"
              onClick={() => onSendNow(lead)}
              disabled={sendInFlight}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {sendInFlight ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Send now
            </button>
          )}
          <a
            href={`/admin/leads-crm?leadId=${lead.id}`}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            View in CRM <ChevronRight size={14} />
          </a>
        </div>
      </div>
    </aside>
  );
}

function SendRateBar({ sent, cap }: { sent: number; cap: number }) {
  const pct = cap > 0 ? Math.min(100, Math.round((sent / cap) * 100)) : 0;
  const tone = pct >= 95 ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
        <span>Today's send rate</span>
        <span>{sent} / {cap}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-[11px] text-slate-500">
        {pct >= 95 ? "At cap — no more sends today" : pct >= 80 ? "Warmup capacity nearly used" : "Within warmup capacity"}
      </div>
    </div>
  );
}
