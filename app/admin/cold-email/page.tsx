"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Clock,
  Edit3,
  ExternalLink,
  Inbox,
  Loader2,
  RefreshCw,
  Rocket,
  Save,
  Search,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { AuthGate, isClientAuthed } from "@/components/admin/auth-gate";
import { StatPill } from "@/components/admin/stat-tile";
import {
  formatDateTime,
  outreachStatusTone,
  qualityChipTone,
  timeUntil,
} from "@/components/admin/lead-helpers";
import type { CrmData, Lead, OutreachStats } from "@/components/admin/types";

type Tab = "pending" | "sent";

const TABS: { value: Tab; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: "pending",
    label: "Pending",
    description: "Drafts awaiting approval — edit, then Approve & Send",
    icon: <ShieldCheck size={16} />,
  },
  {
    value: "sent",
    label: "Sent",
    description: "Every email actually delivered (and any send failures)",
    icon: <Send size={16} />,
  },
];

export default function ColdEmailPage() {
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState<CrmData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("pending");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [actionInFlightId, setActionInFlightId] = useState<number | null>(null);
  const [savingDraftId, setSavingDraftId] = useState<number | null>(null);
  const [cheatsheet, setCheatsheet] = useState(false);
  // Re-render every 30s so timeUntil() text on queued rows ticks down.
  const [, setTick] = useState(0);
  useEffect(() => {
    const handle = window.setInterval(() => setTick((n) => (n + 1) % 1_000_000), 30_000);
    return () => window.clearInterval(handle);
  }, []);

  useEffect(() => {
    setAuthed(isClientAuthed());
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const lid = Number(params.get("leadId") || "");
      if (Number.isFinite(lid) && lid > 0) setSelectedId(lid);
      const t = params.get("tab");
      if (t === "pending" || t === "sent") setTab(t);
    }
  }, []);

  // Sync the active tab to the URL so refreshes preserve view.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (tab === "pending") params.delete("tab");
    else params.set("tab", tab);
    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState(null, "", next);
  }, [tab]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ q: query, limit: "300" });
      params.set("includeArchived", "1");
      // Tab determines the slice we ask the server for. The API sorts
      // outreach-relevant rows first when an outreach filter is set.
      if (tab === "pending") params.set("outreachStatus", "draft");
      else params.set("outreachStatus", "active");
      const res = await fetch(`/api/admin/latchly-leads?${params.toString()}`);
      if (res.status === 401) { setAuthed(false); return; }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setData(json);
    } catch (err: any) {
      setError(err.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [query, tab]);

  useEffect(() => { if (authed) fetchData(); }, [authed, fetchData]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Derive the row list per tab. Server does the heavy filtering; we just
  // bucket sent vs failed for the Sent tab so the UI can group them.
  const rows = useMemo(() => {
    const all = data?.leads || [];
    if (tab === "pending") {
      return all.filter((lead) => lead.outreachStatus === "draft");
    }
    // Sent tab includes day_zero_sent, day_zero_failed, sending — anything
    // with a real attempt history. Order: failures first (need attention),
    // then most-recent sent.
    return all
      .filter((lead) => ["day_zero_sent", "day_zero_failed", "sending", "queued"].includes(String(lead.outreachStatus)))
      .sort((a, b) => {
        const order = (lead: Lead) => {
          if (lead.outreachStatus === "day_zero_failed") return 0;
          if (lead.outreachStatus === "sending") return 1;
          if (lead.outreachStatus === "queued") return 2;
          return 3;
        };
        const oa = order(a);
        const ob = order(b);
        if (oa !== ob) return oa - ob;
        const ta = new Date(a.emailSentAt || a.outreachScheduledFor || a.outreachQueuedAt || 0).getTime();
        const tb = new Date(b.emailSentAt || b.outreachScheduledFor || b.outreachQueuedAt || 0).getTime();
        return tb - ta;
      });
  }, [data?.leads, tab]);

  const selectedLead = useMemo(() => {
    return (data?.leads || []).find((l) => l.id === selectedId) || null;
  }, [data?.leads, selectedId]);

  const outreachStats: OutreachStats = data?.stats.outreach || {
    draft: 0, queued: 0, sending: 0, sent: 0, sentToday: 0, failed: 0, rejected: 0, unsubscribed: 0,
  };

  const rejectDraft = async (lead: Lead) => {
    const reason = window.prompt("Reason for rejecting (optional):", "rejected_in_qa");
    if (reason === null) return;
    setActionInFlightId(lead.id);
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
      setActionInFlightId(null);
    }
  };

  // "Approve & Send" — explicit operator action that bypasses the 7-9am
  // schedule and ships immediately. The save-draft endpoint is called first
  // if the operator was editing, so any in-flight changes ride along.
  const approveAndSend = async (lead: Lead, edits?: { subject?: string; body?: string; email?: string }) => {
    const confirmText = lead.emailStatus === "guessed"
      ? `This email was pattern-guessed (${lead.email}). Sending may bounce — confirm?`
      : `Send to ${lead.email} now? Bypasses the 7-9am-local schedule.`;
    if (!window.confirm(confirmText)) return;
    setActionInFlightId(lead.id);
    try {
      // Persist any in-flight edits before the send so we know what
      // actually shipped.
      if (edits && (edits.subject != null || edits.body != null || edits.email != null)) {
        const saveRes = await fetch(`/api/admin/latchly-leads/${lead.id}/draft`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(edits),
        });
        const saveJson = await saveRes.json();
        if (!saveRes.ok) throw new Error(saveJson.error || "Save failed before send");
      }
      const sendRes = await fetch(`/api/admin/latchly-leads/${lead.id}/send-now`, {
        method: "POST",
      });
      const sendJson = await sendRes.json();
      if (!sendRes.ok) throw new Error(sendJson.error || "Send failed");
      setToast(`Sent to ${lead.email}`);
      await fetchData();
    } catch (err: any) {
      setError(err.message || "Send failed");
    } finally {
      setActionInFlightId(null);
    }
  };

  const saveDraft = async (lead: Lead, edits: { subject?: string; body?: string; email?: string }) => {
    setSavingDraftId(lead.id);
    try {
      const res = await fetch(`/api/admin/latchly-leads/${lead.id}/draft`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edits),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setToast("Draft saved");
      await fetchData();
      return true;
    } catch (err: any) {
      setError(err.message || "Save failed");
      return false;
    } finally {
      setSavingDraftId(null);
    }
  };

  // Keyboard shortcuts. Only active on the Pending tab (drafts) and only
  // when focus is outside an input/textarea/contentEditable so typing in
  // the editor doesn't trigger row navigation. Shortcuts:
  //   j / down arrow — next draft
  //   k / up arrow   — previous draft
  //   a              — Approve & Send the focused draft (confirms)
  //   r              — Reject the focused draft (prompts for reason)
  //   Esc            — clear selection
  //   ?              — toggle cheatsheet
  useEffect(() => {
    if (tab !== "pending") return;
    const handler = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (target.isContentEditable) return;
      }
      const key = event.key;
      if (key === "?") { event.preventDefault(); setCheatsheet((v) => !v); return; }
      if (key === "Escape") { setSelectedId(null); setCheatsheet(false); return; }
      if (!rows.length) return;
      const currentIndex = selectedId == null ? -1 : rows.findIndex((row) => row.id === selectedId);
      if (key === "j" || key === "ArrowDown") {
        event.preventDefault();
        const next = rows[Math.min(rows.length - 1, currentIndex + 1)] || rows[0];
        setSelectedId(next.id);
      } else if (key === "k" || key === "ArrowUp") {
        event.preventDefault();
        const prev = rows[Math.max(0, currentIndex - 1)] || rows[0];
        setSelectedId(prev.id);
      } else if ((key === "a" || key === "A") && selectedLead) {
        event.preventDefault();
        approveAndSend(selectedLead);
      } else if ((key === "r" || key === "R") && selectedLead) {
        event.preventDefault();
        rejectDraft(selectedLead);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [tab, rows, selectedId, selectedLead, approveAndSend, rejectDraft]);

  if (!authed) return <AuthGate onAuth={() => setAuthed(true)} title="Cold Email" />;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
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
            {tab === "pending" && (
              <button
                onClick={() => setCheatsheet((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                title="Keyboard shortcuts"
              >
                <span className="font-mono text-[11px]">?</span>
                Shortcuts
              </button>
            )}
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

      {cheatsheet && tab === "pending" && (
        <div className="fixed top-20 right-4 z-50 w-64 rounded-lg border border-slate-200 bg-white shadow-xl p-4 text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="font-black text-slate-950">Keyboard shortcuts</span>
            <button
              type="button"
              onClick={() => setCheatsheet(false)}
              className="text-slate-400 hover:text-slate-700"
              aria-label="Close cheatsheet"
            >
              <X size={14} />
            </button>
          </div>
          <ul className="space-y-1.5 text-slate-700">
            <li className="flex items-center justify-between gap-2"><span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">j</span> Next draft</li>
            <li className="flex items-center justify-between gap-2"><span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">k</span> Previous draft</li>
            <li className="flex items-center justify-between gap-2"><span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">a</span> Approve &amp; Send focused</li>
            <li className="flex items-center justify-between gap-2"><span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">r</span> Reject focused</li>
            <li className="flex items-center justify-between gap-2"><span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">Esc</span> Clear selection</li>
            <li className="flex items-center justify-between gap-2"><span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">?</span> Toggle this</li>
          </ul>
          <p className="mt-3 text-[10px] text-slate-500 leading-snug">
            Disabled while typing in any input. Approve/Reject still confirm.
          </p>
        </div>
      )}

      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-5 space-y-5">
        <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <StatPill icon={<ShieldCheck size={14} />}    label="Pending"     value={outreachStats.draft}        tone="text-violet-700" />
          <StatPill icon={<Inbox size={14} />}          label="Queued"      value={outreachStats.queued}       tone="text-blue-700" />
          <StatPill icon={<Send size={14} />}           label="Sending"     value={outreachStats.sending}      tone="text-amber-700" />
          <StatPill icon={<Clock size={14} />}          label="Sent today"  value={outreachStats.sentToday}    tone="text-emerald-700" />
          <StatPill icon={<Check size={14} />}          label="Sent total"  value={outreachStats.sent}         tone="text-emerald-700" />
          <StatPill icon={<AlertTriangle size={14} />}  label="Failed"      value={outreachStats.failed}       tone="text-rose-700" />
          <StatPill icon={<X size={14} />}              label="Rejected"    value={outreachStats.rejected}     tone="text-zinc-600" />
          <StatPill icon={<X size={14} />}              label="Unsub"       value={outreachStats.unsubscribed} tone="text-zinc-600" />
        </section>

        <section className="bg-white border border-slate-200 rounded-lg p-4">
          <SendRateBar sent={outreachStats.sentToday} cap={outreachStats.dailyCap ?? 50} />
        </section>

        {/* Tab bar */}
        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="flex border-b border-slate-100">
            {TABS.map((t) => {
              const active = tab === t.value;
              const count = t.value === "pending" ? outreachStats.draft : outreachStats.sent + outreachStats.failed;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => { setTab(t.value); setSelectedId(null); }}
                  className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold transition-colors ${
                    active
                      ? "bg-slate-950 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {t.icon}
                  {t.label}
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-700"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="px-4 py-2.5 bg-slate-50 text-xs text-slate-600 border-b border-slate-100">
            {TABS.find((t) => t.value === tab)?.description}
          </div>
          <div className="p-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search business, owner, email"
                className="w-full rounded-md border border-slate-200 pl-9 pr-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </div>
          </div>
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

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_460px] gap-5 items-start">
          <section className="bg-white border border-slate-200 rounded-lg overflow-hidden min-w-0">
            {rows.length === 0 && !loading ? (
              <div className="py-16 text-center text-sm text-slate-500">
                {tab === "pending" ? "Inbox zero — no drafts awaiting approval" : "No emails sent yet"}
              </div>
            ) : (
              rows.map((lead) => (
                <RowCard
                  key={lead.id}
                  lead={lead}
                  tab={tab}
                  selected={selectedId === lead.id}
                  onSelect={() => setSelectedId(lead.id)}
                />
              ))
            )}
            {loading && (
              <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
                <Loader2 size={13} className="animate-spin" /> Loading…
              </div>
            )}
          </section>

          {tab === "pending" ? (
            <PendingDetail
              lead={selectedLead}
              onSaveDraft={saveDraft}
              onApproveAndSend={approveAndSend}
              onReject={rejectDraft}
              actionInFlight={Boolean(selectedLead && actionInFlightId === selectedLead.id)}
              savingDraft={Boolean(selectedLead && savingDraftId === selectedLead.id)}
            />
          ) : (
            <SentDetail lead={selectedLead} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── List rows ───────────────────────────────────────────────────────────────

function RowCard({
  lead, tab, selected, onSelect,
}: {
  lead: Lead;
  tab: Tab;
  selected: boolean;
  onSelect: () => void;
}) {
  const status = lead.outreachStatus || "none";
  const statusLabel = status === "day_zero_sent"
    ? "sent"
    : status === "day_zero_failed"
      ? "failed"
      : status === "queued"
        ? (timeUntil(lead.outreachScheduledFor) || "queued")
        : status;
  const timestampText =
    status === "day_zero_sent"
      ? formatDateTime(lead.emailSentAt)
      : status === "day_zero_failed"
        ? "needs retry"
        : status === "queued"
          ? `scheduled ${formatDateTime(lead.outreachScheduledFor)}`
          : "";

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
            {lead.emailStatus === "guessed" && (
              <span
                className="inline-flex border border-amber-300 bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded-md text-[10px] font-bold"
                title="Pattern-guessed · domain MX validated, mailbox unverified"
              >
                ⚠ guessed
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-slate-700 truncate">
            {lead.emailSubject || <span className="text-slate-400 italic">No subject yet</span>}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 truncate">
            {lead.email || "no email"} · {lead.decisionMakerName || "no owner"}
            {lead.city ? ` · ${lead.city}` : ""}
            {tab === "sent" && timestampText ? ` · ${timestampText}` : ""}
          </div>
          {lead.outreachError && (
            <div className="mt-1 text-[11px] text-rose-700 truncate">⚠ {lead.outreachError}</div>
          )}
        </div>
        <div className="text-right shrink-0">
          <span className={`inline-flex border px-2 py-0.5 rounded-md text-[10px] font-bold ${outreachStatusTone(status)}`}>
            {statusLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Pending detail (editable + approve & send) ──────────────────────────────

function PendingDetail({
  lead, onSaveDraft, onApproveAndSend, onReject, actionInFlight, savingDraft,
}: {
  lead: Lead | null;
  onSaveDraft: (lead: Lead, edits: { subject?: string; body?: string; email?: string }) => Promise<boolean>;
  onApproveAndSend: (lead: Lead, edits?: { subject?: string; body?: string; email?: string }) => void;
  onReject: (lead: Lead) => void;
  actionInFlight: boolean;
  savingDraft: boolean;
}) {
  const [subjectDraft, setSubjectDraft] = useState("");
  const [bodyDraft, setBodyDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [editing, setEditing] = useState(false);

  // Reset form whenever a different lead is selected.
  useEffect(() => {
    if (!lead) return;
    setSubjectDraft(lead.emailSubject || "");
    setBodyDraft(lead.emailBodyPreview || "");
    setEmailDraft(lead.email || "");
    setEditing(false);
  }, [lead?.id, lead?.emailSubject, lead?.emailBodyPreview, lead?.email]);

  if (!lead) {
    return (
      <aside className="bg-white border border-slate-200 rounded-lg min-h-[420px] flex items-center justify-center text-sm text-slate-500 sticky top-24">
        Select a draft to review and approve.
      </aside>
    );
  }

  const dirty =
    subjectDraft !== (lead.emailSubject || "")
    || bodyDraft !== (lead.emailBodyPreview || "")
    || emailDraft !== (lead.email || "");

  const handleSend = () => {
    onApproveAndSend(lead, dirty
      ? {
          subject: subjectDraft !== (lead.emailSubject || "") ? subjectDraft : undefined,
          body: bodyDraft !== (lead.emailBodyPreview || "") ? bodyDraft : undefined,
          email: emailDraft !== (lead.email || "") ? emailDraft : undefined,
        }
      : undefined);
  };

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
          <span className="shrink-0 inline-flex border border-violet-200 bg-violet-50 text-violet-800 px-2 py-1 rounded-md text-[11px] font-bold">
            Draft
          </span>
        </div>
      </div>

      {lead.emailStatus === "guessed" && (
        <div className="mx-5 mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
          <div className="font-bold flex items-center gap-1.5">⚠ Pattern-guessed email</div>
          <div className="mt-1 leading-relaxed">
            We MX-validated <span className="font-mono">{lead.email}</span> but did not verify the mailbox itself.
            Sending may bounce. Edit the address below or reject the draft if you can't confirm it.
          </div>
        </div>
      )}

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

        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block">To</label>
          <input
            value={emailDraft}
            onChange={(event) => { setEmailDraft(event.target.value); setEditing(true); }}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-mono outline-none focus:border-teal-500"
            placeholder="recipient@example.com"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block">Subject</label>
          <input
            value={subjectDraft}
            onChange={(event) => { setSubjectDraft(event.target.value); setEditing(true); }}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-teal-500"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block">Body</label>
          <textarea
            value={bodyDraft}
            onChange={(event) => { setBodyDraft(event.target.value); setEditing(true); }}
            rows={12}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-xs leading-5 font-sans outline-none focus:border-teal-500 resize-y"
          />
          <p className="mt-1 text-[10px] text-slate-500">
            {dirty ? "Unsaved edits — Save or Approve & Send to persist them." : "Tap inside any field to edit."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={handleSend}
            disabled={actionInFlight || !emailDraft || !subjectDraft}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {actionInFlight ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Approve &amp; Send
          </button>
          <button
            type="button"
            onClick={() => onSaveDraft(lead, {
              subject: dirty ? subjectDraft : undefined,
              body: dirty ? bodyDraft : undefined,
              email: dirty ? emailDraft : undefined,
            })}
            disabled={savingDraft || !dirty}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {savingDraft ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save draft
          </button>
          <button
            type="button"
            onClick={() => onReject(lead)}
            disabled={actionInFlight}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
          >
            <X size={14} /> Reject
          </button>
          <a
            href={`/admin/leads-crm?leadId=${lead.id}`}
            className="ml-auto inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            View in CRM <ChevronRight size={14} />
          </a>
        </div>
      </div>
    </aside>
  );
}

// ── Sent detail (read-only full body view) ──────────────────────────────────

function SentDetail({ lead }: { lead: Lead | null }) {
  if (!lead) {
    return (
      <aside className="bg-white border border-slate-200 rounded-lg min-h-[420px] flex items-center justify-center text-sm text-slate-500 sticky top-24">
        Select a row to inspect the email and timestamps.
      </aside>
    );
  }
  const status = lead.outreachStatus || "none";
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
            {status === "day_zero_sent" ? "sent" : status}
          </span>
        </div>
        <div className="mt-2 text-xs text-slate-600">
          To <span className="font-mono text-slate-900">{lead.email || "—"}</span>
          {lead.decisionMakerName && <> · {lead.decisionMakerName}</>}
        </div>
      </div>

      <div className="p-5 space-y-4 overflow-y-auto">
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

        <div className="flex gap-2 pt-2 border-t border-slate-100">
          <a
            href={`/admin/leads-crm?leadId=${lead.id}`}
            className="ml-auto inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
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
        {cap === 0
          ? "Pre-warmup — no sends until WARMUP_START hits"
          : pct >= 95 ? "At cap — no more sends today"
          : pct >= 80 ? "Warmup capacity nearly used"
          : "Within warmup capacity"}
      </div>
    </div>
  );
}
