"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarClock,
  Check,
  ChevronRight,
  ExternalLink,
  Filter,
  Globe,
  Loader2,
  Mail,
  MapPin,
  NotebookTabs,
  Phone,
  Play,
  RefreshCw,
  Save,
  Search,
  Send,
  Star,
  UserRound,
} from "lucide-react";
import { AuthGate, isClientAuthed } from "@/components/admin/auth-gate";
import { StatTile } from "@/components/admin/stat-tile";
import {
  contactSummary,
  formatDate,
  opportunityLabel,
  opportunityTone,
  outreachStatusLabel,
  outreachStatusTone,
  qualityChipTone,
  statusLabel,
  statusTone,
  tierLabel,
  tierTone,
  toDateInput,
  websiteHref,
} from "@/components/admin/lead-helpers";
import {
  STATUS_OPTIONS,
  type CrmData,
  type CrmStatus,
  type Lead,
} from "@/components/admin/types";

export default function LeadsCrmPage() {
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState<CrmData | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [tier, setTier] = useState("all");
  const [city, setCity] = useState("all");
  const [niche, setNiche] = useState("all");
  const [minScore, setMinScore] = useState("0");
  const [localOnly, setLocalOnly] = useState(false);
  const [noWebsite, setNoWebsite] = useState(false);
  const [poorWebsite, setPoorWebsite] = useState(false);
  const [toast, setToast] = useState("");
  const [scrapeDispatching, setScrapeDispatching] = useState(false);
  const [scrapePending, setScrapePending] = useState(false);
  const [markingContactedId, setMarkingContactedId] = useState<number | null>(null);
  const [enrichingId, setEnrichingId] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const initialStatus = params.get("status");
    const initialTier = params.get("tier");
    const initialLeadId = Number(params.get("leadId") || "");
    if (initialStatus && (initialStatus === "all" || STATUS_OPTIONS.some((o) => o.value === initialStatus))) {
      setStatus(initialStatus);
    }
    if (initialTier === "premium" || initialTier === "standard") setTier(initialTier);
    if (Number.isFinite(initialLeadId) && initialLeadId > 0) setSelectedId(initialLeadId);
    setAuthed(isClientAuthed());
  }, []);

  useEffect(() => {
    if (tier === "premium") {
      setMinScore("9");
      setNoWebsite(false);
      setPoorWebsite(false);
    }
  }, [tier]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (status === "all") params.delete("status"); else params.set("status", status);
    if (tier === "all") params.delete("tier"); else params.set("tier", tier);
    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState(null, "", next);
  }, [status, tier]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        q: query,
        status,
        tier,
        city,
        niche,
        minScore: tier === "premium" ? "9" : minScore,
        limit: "150",
      });
      if (localOnly) params.set("local", "1");
      if (tier === "premium") params.set("websiteIssue", "1");
      if (noWebsite) params.set("noWebsite", "1");
      if (poorWebsite) params.set("poorWebsite", "1");

      const res = await fetch(`/api/admin/latchly-leads?${params.toString()}`);
      const json = await res.json();
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      if (!res.ok) throw new Error(json.error || "Failed to load leads");
      setData(json);
      setSelectedId((current) => {
        if (current && json.leads.some((lead: Lead) => lead.id === current)) return current;
        return json.leads[0]?.id ?? null;
      });
    } catch (err: any) {
      setError(err.message || "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, [city, localOnly, minScore, niche, noWebsite, poorWebsite, query, status, tier]);

  useEffect(() => {
    if (authed) fetchData();
  }, [authed, fetchData]);

  const selectedLead = useMemo(() => {
    return data?.leads.find((lead) => lead.id === selectedId) || null;
  }, [data?.leads, selectedId]);

  const handleSaved = (updated: Lead) => {
    setData((current) => {
      if (!current) return current;
      const keep = status === "all" || updated.status === status;
      return {
        ...current,
        leads: keep
          ? current.leads.map((lead) => lead.id === updated.id ? updated : lead)
          : current.leads.filter((lead) => lead.id !== updated.id),
      };
    });
  };

  const markContacted = async (lead: Lead) => {
    if (lead.status === "contacted") return;
    const optimistic = { ...lead, status: "contacted" as CrmStatus, lastContactedAt: new Date().toISOString() };
    setMarkingContactedId(lead.id);
    handleSaved(optimistic);
    setToast("Marked contacted");
    try {
      const res = await fetch(`/api/admin/latchly-leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "contacted" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      handleSaved(json.lead);
      await fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to mark contacted");
      await fetchData();
    } finally {
      setMarkingContactedId(null);
    }
  };

  const enrichLead = async (lead: Lead, target: "email" | "owner" | "all" = "all") => {
    setEnrichingId(lead.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/latchly-leads/${lead.id}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets: target === "all" ? ["email", "owner"] : [target] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Enrichment failed");
      const found: string[] = [];
      if (json.changes?.email) found.push(`email via ${json.changes.email.via}`);
      if (json.changes?.decisionMakerName) found.push(`owner via ${json.changes.decisionMakerName.via}`);
      if (found.length) {
        setToast(`Enriched: ${found.join(", ")}`);
      } else {
        const note = (json.notes || []).join(" · ");
        setToast(`No new info found${note ? ` · ${note}` : ""}`);
      }
      await fetchData();
    } catch (err: any) {
      setError(err.message || "Enrichment failed");
    } finally {
      setEnrichingId(null);
    }
  };

  const pollRuns = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/latchly-leads/runs");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load runs");
      const latest = json.runs?.[0];
      if (!latest || !["pending", "running"].includes(latest.status)) {
        setScrapePending(false);
      }
      await fetchData();
    } catch {
      await fetchData();
    }
  }, [fetchData]);

  const runScrapeNow = async () => {
    setScrapeDispatching(true);
    setError("");
    try {
      const res = await fetch("/api/admin/latchly-leads/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: tier === "all" ? "both" : tier,
          target: 50,
          dry_run: false,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Dispatch failed");
      setScrapePending(true);
      setToast("Scrape dispatched · workflow takes ~30-60 minutes");
      await pollRuns();
    } catch (err: any) {
      setError(err.message || "Failed to dispatch scrape");
    } finally {
      setScrapeDispatching(false);
    }
  };

  useEffect(() => {
    const status = data?.latestRun?.status;
    if (status === "pending" || status === "running") {
      setScrapePending(true);
    }
  }, [data?.latestRun?.status]);

  useEffect(() => {
    if (!authed || !scrapePending) return;
    const timer = window.setInterval(() => { pollRuns(); }, 30000);
    return () => window.clearInterval(timer);
  }, [authed, pollRuns, scrapePending]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const statusCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of data?.statusCounts || []) map.set(item.status, item.count);
    return map;
  }, [data?.statusCounts]);

  const statusTabs = [
    { value: "all",       label: "All",       count: data?.stats.total || 0 },
    { value: "new",       label: "New",       count: statusCountMap.get("new") || 0 },
    { value: "contacted", label: "Contacted", count: statusCountMap.get("contacted") || 0 },
    { value: "won",       label: "Won",       count: statusCountMap.get("won") || 0 },
    { value: "lost",      label: "Lost",      count: statusCountMap.get("lost") || 0 },
  ];

  const latestRunStatus = data?.latestRun?.status || "";
  const runInProgress = scrapeDispatching || scrapePending || latestRunStatus === "pending" || latestRunStatus === "running";

  if (!authed) return <AuthGate onAuth={() => setAuthed(true)} title="Leads CRM" />;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 lg:top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center">
              <Building2 size={18} />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-black text-slate-950 leading-tight">Leads CRM</h1>
              <p className="text-xs text-slate-500 leading-tight truncate">
                Scored home-service opportunities · status workflow
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
            <button
              onClick={runScrapeNow}
              disabled={runInProgress}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {runInProgress ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
              Run scrape
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto px-4 sm:px-6 py-5 space-y-5">
        {data && (
          <div className="grid grid-cols-2 lg:grid-cols-5 xl:grid-cols-10 gap-3">
            <StatTile icon={<Building2 size={15} />} label="In CRM" value={data.stats.total} />
            <StatTile icon={<Star size={15} />} label="Premium" value={data.stats.premium} />
            <StatTile icon={<Star size={15} />} label="Avg Score" value={data.stats.avgScore ?? "-"} />
            <StatTile icon={<NotebookTabs size={15} />} label="New" value={data.stats.new} />
            <StatTile icon={<Phone size={15} />} label="Active" value={data.stats.active} />
            <StatTile icon={<MapPin size={15} />} label="Local" value={data.stats.local} />
            <StatTile icon={<Globe size={15} />} label="No Website" value={data.stats.noWebsite} />
            <StatTile icon={<Globe size={15} />} label="Poor Site" value={data.stats.poorWebsite} />
            <StatTile icon={<CalendarClock size={15} />} label="Due" value={data.stats.dueFollowUp} />
            <StatTile icon={<Check size={15} />} label="Won" value={data.stats.won} />
          </div>
        )}

        {data && (
          <section className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              {data.latestRun ? (
                <>
                  <span className="font-black text-slate-950">Run {formatDate(data.latestRun.runDate)}</span>
                  <span className="text-slate-600">{data.latestRun.delivered}/{data.latestRun.target} delivered</span>
                  <span className="text-slate-600">{data.latestRun.premiumDelivered || 0} premium</span>
                  <span className="text-slate-600">{data.latestRun.local} local</span>
                  <span className="text-slate-600">{data.latestRun.rejected} rejected</span>
                </>
              ) : (
                <span className="font-black text-slate-950">No lead run recorded</span>
              )}
              <span className="text-emerald-700 font-semibold">{data.stats.total} in CRM</span>
              {data.stats.outreach && (
                <a
                  href="/admin/cold-email"
                  className="inline-flex items-center gap-1.5 rounded-md border border-violet-100 bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700 hover:bg-violet-100"
                >
                  <Send size={12} /> {data.stats.outreach.queued + data.stats.outreach.draft} in outreach
                </a>
              )}
            </div>
            {data.latestRun?.underTargetReason && (
              <div className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                {data.latestRun.underTargetReason}
              </div>
            )}
          </section>
        )}

        {toast && (
          <div className="rounded-lg border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800">
            {toast}
          </div>
        )}

        <section className="bg-white border border-slate-200 rounded-lg p-2 overflow-x-auto">
          <div className="flex min-w-max gap-1">
            {statusTabs.map((tab) => {
              const active = status === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setStatus(tab.value)}
                  className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold transition-colors ${
                    active ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {tab.label}
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600"}`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(220px,1fr)_140px_160px_180px_120px_auto_auto_auto_auto] gap-3 items-center">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search business, contact, phone"
                className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2.5 text-sm outline-none focus:border-teal-500"
              />
            </div>
            <select value={tier} onChange={(event) => setTier(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500 bg-white">
              <option value="all">All tiers</option>
              <option value="premium">Premium</option>
              <option value="standard">Standard</option>
            </select>
            <select value={city} onChange={(event) => setCity(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500 bg-white">
              <option value="all">All cities</option>
              {data?.filters.cities.map((option) => (
                <option key={option.city} value={option.city}>{option.city} ({option.count})</option>
              ))}
            </select>
            <select value={niche} onChange={(event) => setNiche(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500 bg-white">
              <option value="all">All niches</option>
              {data?.filters.niches.map((option) => (
                <option key={option.niche} value={option.niche}>{option.niche} ({option.count})</option>
              ))}
            </select>
            <select value={tier === "premium" ? "9" : minScore} disabled={tier === "premium"} onChange={(event) => setMinScore(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500 bg-white disabled:bg-slate-50 disabled:text-slate-400">
              <option value="0">Any score</option>
              <option value="8">8+</option>
              <option value="9">9+</option>
              <option value="9.5">9.5+</option>
            </select>
            <label className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-bold cursor-pointer ${localOnly ? "border-teal-200 bg-teal-50 text-teal-800" : "border-slate-200 bg-white text-slate-700"}`}>
              <input type="checkbox" checked={localOnly} onChange={(event) => setLocalOnly(event.target.checked)} className="sr-only" />
              <MapPin size={15} /> Local
            </label>
            <label className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-bold cursor-pointer ${noWebsite ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-white text-slate-700"}`}>
              <input type="checkbox" checked={noWebsite} disabled={tier === "premium"} onChange={(event) => setNoWebsite(event.target.checked)} className="sr-only" />
              <Globe size={15} /> No site
            </label>
            <label className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-bold cursor-pointer ${tier === "premium" || poorWebsite ? "border-rose-200 bg-rose-50 text-rose-800" : "border-slate-200 bg-white text-slate-700"}`}>
              <input type="checkbox" checked={tier === "premium" || poorWebsite} disabled={tier === "premium"} onChange={(event) => setPoorWebsite(event.target.checked)} className="sr-only" />
              <Globe size={15} /> Poor site
            </label>
            <button
              onClick={() => {
                setQuery(""); setStatus("all"); setTier("all"); setCity("all"); setNiche("all");
                setMinScore("0"); setLocalOnly(false); setNoWebsite(false); setPoorWebsite(false);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              <Filter size={15} /> Reset
            </button>
          </div>
        </section>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_430px] gap-5 items-start">
          <section className="bg-white border border-slate-200 rounded-lg overflow-hidden min-w-0">
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Building2 size={16} className="text-slate-500" />
                <span className="text-sm font-black text-slate-950">
                  {data?.leads.length ?? 0}
                  {data && data.leads.length < (data.stats.total || 0) ? (
                    <span className="font-bold text-slate-500"> of {data.stats.total} (filters active)</span>
                  ) : (
                    <span className="text-slate-500"> leads</span>
                  )}
                </span>
              </div>
              {loading && <Loader2 size={16} className="animate-spin text-slate-500" />}
            </div>
            <div className="hidden md:grid grid-cols-[minmax(220px,1.6fr)_130px_120px_100px_150px_130px] gap-3 px-4 py-2 bg-slate-50 border-t border-slate-100 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <div>Business</div>
              <div>Market</div>
              <div>Status</div>
              <div>Score</div>
              <div>Tier / Flags</div>
              <div className="text-right">Action</div>
            </div>
            {!data || data.leads.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-500">
                {loading ? "Loading leads..." : "No leads match"}
              </div>
            ) : (
              data.leads.map((lead) => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  selected={lead.id === selectedId}
                  onSelect={() => setSelectedId(lead.id)}
                  onMarkContacted={markContacted}
                  markingContacted={markingContactedId === lead.id}
                />
              ))
            )}
          </section>

          <LeadDetail
            lead={selectedLead}
            onSaved={handleSaved}
            onMarkContacted={markContacted}
            markingContacted={Boolean(selectedLead && markingContactedId === selectedLead.id)}
            onEnrich={enrichLead}
            enriching={Boolean(selectedLead && enrichingId === selectedLead.id)}
          />
        </div>
      </main>
    </div>
  );
}

interface LeadRowProps {
  lead: Lead;
  selected: boolean;
  onSelect: () => void;
  onMarkContacted: (lead: Lead) => void;
  markingContacted: boolean;
}

function LeadRow({ lead, selected, onSelect, onMarkContacted, markingContacted }: LeadRowProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(); }}
      className={`w-full text-left px-4 py-3 border-t border-slate-100 hover:bg-slate-50 transition-colors ${
        selected ? "bg-teal-50/70" : "bg-white"
      }`}
    >
      <div className="hidden md:grid grid-cols-[minmax(220px,1.6fr)_130px_120px_100px_150px_130px] gap-3 items-center">
        <div className="min-w-0">
          <div className="font-bold text-sm text-slate-950 truncate">{lead.businessName}</div>
          <div className="text-xs text-slate-500 truncate">
            {contactSummary(lead)}
            {!lead.email && <span className="ml-1.5 inline-flex border border-amber-100 bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-bold align-middle">no email</span>}
            {!lead.decisionMakerName && <span className="ml-1.5 inline-flex border border-amber-100 bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-bold align-middle">no owner</span>}
          </div>
        </div>
        <div className="text-xs text-slate-600 min-w-0">
          <div className="truncate">{lead.city || "-"}</div>
          <div className="text-slate-400 truncate">{lead.niche || "-"}</div>
        </div>
        <span className={`inline-flex w-fit border px-2 py-1 rounded-md text-[11px] font-bold ${statusTone(lead.status)}`}>
          {statusLabel(lead.status)}
        </span>
        <div className="flex items-center gap-1.5 text-sm font-black text-slate-950">
          <Star size={14} className="text-amber-500 fill-amber-500" />
          {lead.score ?? "-"}
        </div>
        <div className="text-xs text-slate-500">
          {lead.isLocalMarket && <div className="font-bold text-teal-700">Local</div>}
          <div className="flex flex-wrap gap-1.5">
            <span className={`inline-flex border px-2 py-1 rounded-md text-[11px] font-bold ${tierTone(lead.tier)}`}>
              {tierLabel(lead.tier)}
            </span>
            <span className={`inline-flex border px-2 py-1 rounded-md text-[11px] font-bold ${opportunityTone(lead)}`}>
              {opportunityLabel(lead)}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          {lead.status !== "contacted" && (
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); onMarkContacted(lead); }}
              disabled={markingContacted}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              {markingContacted ? <Loader2 size={13} className="animate-spin" /> : <Phone size={13} />}
              Contacted
            </button>
          )}
          <ChevronRight size={16} className="text-slate-400" />
        </div>
      </div>

      <div className="md:hidden space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-bold text-sm text-slate-950">{lead.businessName}</div>
            <div className="text-xs text-slate-500">{[lead.city, lead.state].filter(Boolean).join(", ") || "-"}</div>
          </div>
          <div className="text-sm font-black text-slate-950 shrink-0">{lead.score ?? "-"}/10</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`inline-flex border px-2 py-1 rounded-md text-[11px] font-bold ${statusTone(lead.status)}`}>
            {statusLabel(lead.status)}
          </span>
          {lead.isLocalMarket && <span className="inline-flex border border-teal-100 bg-teal-50 text-teal-700 px-2 py-1 rounded-md text-[11px] font-bold">Local</span>}
          <span className={`inline-flex border px-2 py-1 rounded-md text-[11px] font-bold ${tierTone(lead.tier)}`}>{tierLabel(lead.tier)}</span>
          <span className={`inline-flex border px-2 py-1 rounded-md text-[11px] font-bold ${opportunityTone(lead)}`}>{opportunityLabel(lead)}</span>
          {lead.demoUrl && (
            <a
              href={lead.demoUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 px-2 py-1 rounded-md text-[11px] font-bold"
            >
              Demo
            </a>
          )}
          {!lead.email && <span className="inline-flex border border-amber-100 bg-amber-50 text-amber-700 px-2 py-1 rounded-md text-[11px] font-bold">no email</span>}
          {!lead.decisionMakerName && <span className="inline-flex border border-amber-100 bg-amber-50 text-amber-700 px-2 py-1 rounded-md text-[11px] font-bold">no owner</span>}
        </div>
        {lead.status !== "contacted" && (
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onMarkContacted(lead); }}
            disabled={markingContacted}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 disabled:opacity-50"
          >
            {markingContacted ? <Loader2 size={14} className="animate-spin" /> : <Phone size={14} />}
            Mark Contacted
          </button>
        )}
      </div>
    </div>
  );
}

interface LeadDetailProps {
  lead: Lead | null;
  onSaved: (lead: Lead) => void;
  onMarkContacted: (lead: Lead) => void;
  markingContacted: boolean;
  onEnrich: (lead: Lead, target?: "email" | "owner" | "all") => void;
  enriching: boolean;
}

function LeadDetail({ lead, onSaved, onMarkContacted, markingContacted, onEnrich, enriching }: LeadDetailProps) {
  const [draft, setDraft] = useState({
    status: "new" as CrmStatus,
    notes: "",
    phone: "",
    email: "",
    website: "",
    decisionMakerName: "",
    decisionMakerTitle: "",
    lastContactedAt: "",
    nextFollowUpDate: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!lead) return;
    setDraft({
      status: lead.status,
      notes: lead.notes || "",
      phone: lead.phone || "",
      email: lead.email || "",
      website: lead.website || "",
      decisionMakerName: lead.decisionMakerName || "",
      decisionMakerTitle: lead.decisionMakerTitle || "",
      lastContactedAt: toDateInput(lead.lastContactedAt),
      nextFollowUpDate: toDateInput(lead.nextFollowUpDate),
    });
    setSaved(false);
    setError("");
  }, [lead]);

  const save = async () => {
    if (!lead) return;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch(`/api/admin/latchly-leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      onSaved(json.lead);
      setSaved(true);
    } catch (err: any) {
      setError(err.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (!lead) {
    return (
      <aside className="bg-white border border-slate-200 rounded-lg min-h-[420px] flex items-center justify-center text-sm text-slate-500">
        No lead selected
      </aside>
    );
  }

  return (
    <aside className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-black text-slate-950 leading-tight">{lead.businessName}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={`inline-flex border px-2 py-1 rounded-md text-[11px] font-bold ${statusTone(lead.status)}`}>
                {statusLabel(lead.status)}
              </span>
              {lead.isLocalMarket && <span className="inline-flex border border-teal-100 bg-teal-50 text-teal-700 px-2 py-1 rounded-md text-[11px] font-bold">Local</span>}
              <span className={`inline-flex border px-2 py-1 rounded-md text-[11px] font-bold ${tierTone(lead.tier)}`}>
                {tierLabel(lead.tier)}
              </span>
              <span className={`inline-flex border px-2 py-1 rounded-md text-[11px] font-bold ${opportunityTone(lead)}`}>
                {opportunityLabel(lead)}
              </span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-3xl font-black text-slate-950">{lead.score ?? "-"}</div>
            <div className="text-[11px] font-bold text-slate-500 uppercase">Score</div>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase text-slate-500 mb-1">
              <MapPin size={13} /> Market
            </div>
            <div className="font-semibold text-slate-900 truncate">{[lead.city, lead.state].filter(Boolean).join(", ") || "-"}</div>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase text-slate-500 mb-1">
              <Building2 size={13} /> Niche
            </div>
            <div className="font-semibold text-slate-900 truncate">{lead.niche || "-"}</div>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase text-slate-500 mb-1">
              <Star size={13} /> Signals
            </div>
            <div className="font-semibold text-slate-900 truncate">{lead.signalCount || 0}</div>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase text-slate-500 mb-1">
              <Star size={13} /> Demo
            </div>
            <div className="font-semibold text-slate-900 truncate">
              {typeof lead.demoQualityScore === "number"
                ? <span className={`inline-flex border px-2 py-0.5 rounded-md text-[11px] font-bold ${qualityChipTone(lead.demoQualityScore)}`}>{lead.demoQualityScore.toFixed(0)}/100</span>
                : "-"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {draft.phone && (
            <a href={`tel:${draft.phone}`} className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 text-white px-3 py-2.5 text-sm font-bold hover:bg-teal-600">
              <Phone size={15} /> Call
            </a>
          )}
          {draft.email && (
            <a href={`mailto:${draft.email}`} className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-800 text-white px-3 py-2.5 text-sm font-bold hover:bg-slate-700">
              <Mail size={15} /> Email
            </a>
          )}
          {draft.website && (
            <a href={websiteHref(draft.website)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 text-slate-800 px-3 py-2.5 text-sm font-bold hover:bg-slate-50">
              <Globe size={15} /> Website <ExternalLink size={13} />
            </a>
          )}
          {lead.demoUrl && (
            <a href={lead.demoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 text-slate-800 px-3 py-2.5 text-sm font-bold hover:bg-slate-50">
              <ExternalLink size={15} /> Demo
            </a>
          )}
        </div>

        {/* One-line outreach summary; full controls live in /admin/cold-email */}
        {lead.outreachStatus && lead.outreachStatus !== "none" && (
          <a
            href={`/admin/cold-email?leadId=${lead.id}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 hover:bg-slate-50"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className={`inline-flex border px-2 py-0.5 rounded-md text-[11px] font-bold ${outreachStatusTone(lead.outreachStatus)}`}>
                {outreachStatusLabel(lead)}
              </span>
              {lead.emailSubject && (
                <span className="text-xs text-slate-600 truncate">{lead.emailSubject}</span>
              )}
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-violet-700 shrink-0">
              View in Cold Email <ChevronRight size={12} />
            </span>
          </a>
        )}

        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase text-slate-500">
              <UserRound size={14} /> Contact
            </div>
            <div className="flex items-center gap-1.5">
              {!lead.email && (
                <button
                  type="button"
                  onClick={() => onEnrich(lead, "email")}
                  disabled={enriching}
                  className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                  title="Scrape contact pages and pattern-guess the owner email"
                >
                  {enriching ? <Loader2 size={11} className="animate-spin" /> : <Mail size={11} />} Find email
                </button>
              )}
              {!lead.decisionMakerName && (
                <button
                  type="button"
                  onClick={() => onEnrich(lead, "owner")}
                  disabled={enriching}
                  className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                  title="Scrape about/team pages for the owner name"
                >
                  {enriching ? <Loader2 size={11} className="animate-spin" /> : <UserRound size={11} />} Find owner
                </button>
              )}
              {lead.email && lead.decisionMakerName && (
                <button
                  type="button"
                  onClick={() => onEnrich(lead, "all")}
                  disabled={enriching}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  title="Re-run enrichment to refresh email + owner"
                >
                  {enriching ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Re-enrich
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input value={draft.decisionMakerName} onChange={(event) => setDraft({ ...draft, decisionMakerName: event.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500" placeholder="Name" />
            <input value={draft.decisionMakerTitle} onChange={(event) => setDraft({ ...draft, decisionMakerTitle: event.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500" placeholder="Title" />
            <input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500" placeholder="Phone" />
            <input value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500" placeholder="Email" />
            <input value={draft.website} onChange={(event) => setDraft({ ...draft, website: event.target.value })} className="sm:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500" placeholder="Website" />
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase text-slate-500 mb-2">
            <NotebookTabs size={14} /> CRM
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as CrmStatus })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 bg-white">
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onMarkContacted(lead)}
              disabled={markingContacted || lead.status === "contacted"}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              {markingContacted ? <Loader2 size={15} className="animate-spin" /> : <Phone size={15} />}
              Mark Contacted
            </button>
            <input type="date" value={draft.lastContactedAt} onChange={(event) => setDraft({ ...draft, lastContactedAt: event.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500" />
            <input type="date" value={draft.nextFollowUpDate} onChange={(event) => setDraft({ ...draft, nextFollowUpDate: event.target.value })} className="sm:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500" />
            <textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} rows={4} className="sm:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 resize-none" placeholder="Notes" />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 text-white px-4 py-2.5 text-sm font-bold hover:bg-slate-800 disabled:opacity-50">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Save
            </button>
            {saved && <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700"><Check size={15} /> Saved</span>}
            {error && <span className="text-sm font-semibold text-rose-600">{error}</span>}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase text-slate-500 mb-2">
            <Star size={14} /> Score Reasons
          </div>
          <div className="flex flex-wrap gap-2">
            {lead.scoreReasons.length ? lead.scoreReasons.map((reason) => (
              <span key={reason} className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                {reason}
              </span>
            )) : <span className="text-sm text-slate-500">-</span>}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="text-[11px] font-bold uppercase text-slate-500">Pitch</div>
          <p className="text-sm text-slate-900 leading-6">{lead.pitch.opener || "-"}</p>
          {lead.pitch.angle && <p className="text-sm text-slate-700 leading-6">{lead.pitch.angle}</p>}
          {lead.pitch.nextAction && <p className="text-sm font-semibold text-teal-800 leading-6">{lead.pitch.nextAction}</p>}
        </div>

        <div className="text-xs text-slate-500">
          Delivered {formatDate(lead.deliveredAt)} · Updated {formatDate(lead.updatedAt)} · Source {lead.sourceName || "-"}
        </div>
      </div>
    </aside>
  );
}
