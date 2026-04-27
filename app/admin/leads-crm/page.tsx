"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarClock,
  Check,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  Filter,
  Globe,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MapPin,
  NotebookTabs,
  Phone,
  RefreshCw,
  Save,
  Search,
  Star,
  UserRound,
} from "lucide-react";

type CrmStatus = "new" | "reviewed" | "contacted" | "interested" | "follow_up" | "not_fit" | "won" | "lost";

interface Lead {
  id: number;
  businessKey: string;
  businessName: string;
  niche: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  website: string;
  websiteStatus: string;
  sourceName: string;
  decisionMakerName: string;
  decisionMakerTitle: string;
  decisionMakerConfidence: number | null;
  score: number | null;
  scoreReasons: string[];
  scoreBlockers: string[];
  pitch: {
    opener?: string;
    angle?: string;
    why?: string;
    nextAction?: string;
    caution?: string;
  };
  isLocalMarket: boolean;
  status: CrmStatus;
  notes: string;
  lastContactedAt: string | null;
  nextFollowUpDate: string | null;
  deliveredAt: string;
  updatedAt: string;
}

interface CrmData {
  leads: Lead[];
  stats: {
    total: number;
    new: number;
    active: number;
    won: number;
    highScore: number;
    local: number;
    noWebsite: number;
    poorWebsite: number;
    dueFollowUp: number;
    avgScore: number | null;
  };
  statusCounts: { status: CrmStatus; count: number }[];
  filters: {
    cities: { city: string; count: number }[];
    niches: { niche: string; count: number }[];
  };
  latestRun: {
    runDate: string;
    target: number;
    minimum: number;
    candidates: number;
    audited: number;
    qualified: number;
    delivered: number;
    local: number;
    rejected: number;
    rejectionStats: string[];
    underTargetReason: string;
    emailSent: boolean;
    dryRun: boolean;
    createdAt: string;
  } | null;
}

const STATUS_OPTIONS: { value: CrmStatus; label: string; tone: string }[] = [
  { value: "new", label: "New", tone: "bg-sky-50 text-sky-700 border-sky-100" },
  { value: "reviewed", label: "Reviewed", tone: "bg-slate-100 text-slate-700 border-slate-200" },
  { value: "contacted", label: "Contacted", tone: "bg-blue-50 text-blue-700 border-blue-100" },
  { value: "interested", label: "Interested", tone: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  { value: "follow_up", label: "Follow Up", tone: "bg-amber-50 text-amber-800 border-amber-100" },
  { value: "not_fit", label: "Not Fit", tone: "bg-zinc-100 text-zinc-700 border-zinc-200" },
  { value: "won", label: "Won", tone: "bg-teal-50 text-teal-800 border-teal-100" },
  { value: "lost", label: "Lost", tone: "bg-rose-50 text-rose-700 border-rose-100" },
];

function AuthGate({ onAuth }: { onAuth: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError("Invalid password");
        return;
      }
      sessionStorage.setItem("latchly-leads-crm-auth", "1");
      onAuth();
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-5">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 w-full max-w-sm">
        <div className="w-11 h-11 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center mx-auto mb-5">
          <Lock size={20} />
        </div>
        <h1 className="text-xl font-bold text-center text-slate-950">Leads CRM</h1>
        <p className="text-sm text-slate-500 text-center mt-1 mb-6">Enter your dashboard password</p>
        <form onSubmit={submit}>
          <div className="relative mb-4">
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              className="w-full px-4 py-3 pr-10 rounded-lg border border-slate-200 text-sm outline-none focus:border-teal-500"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              aria-label={showPw ? "Hide password" : "Show password"}
              title={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {error && <p className="text-xs text-rose-600 mb-3">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 rounded-lg bg-teal-700 text-white font-bold text-sm disabled:opacity-50 hover:bg-teal-600 transition-colors"
          >
            {loading ? "Checking..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

function StatTile({ icon, label, value, sub }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 min-w-0">
      <div className="flex items-center gap-2 text-slate-500 mb-2">
        {icon}
        <span className="text-[11px] font-bold uppercase tracking-wide truncate">{label}</span>
      </div>
      <div className="text-2xl font-black text-slate-950">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1 truncate">{sub}</div>}
    </div>
  );
}

function statusTone(status: string) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.tone || "bg-slate-100 text-slate-700 border-slate-200";
}

function statusLabel(status: string) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label || status;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  // Bare YYYY-MM-DD parses as UTC midnight, which renders one day earlier
  // in user-local timezones. Treat date-only strings as local-noon to dodge
  // the offset entirely. Full ISO datetimes (with T) keep their UTC instant.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.exec(value);
  let date: Date;
  if (dateOnly) {
    const [, y, m, d] = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) || [];
    date = new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0);
  } else {
    date = new Date(value);
  }
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function toDateInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function websiteHref(website: string) {
  if (!website) return "";
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

function opportunityLabel(lead: Pick<Lead, "website" | "websiteStatus">) {
  if (lead.websiteStatus === "no_website" || !lead.website) return "No Website";
  if (lead.websiteStatus === "poor_website") return "Poor Website";
  return "Website";
}

function opportunityTone(lead: Pick<Lead, "website" | "websiteStatus">) {
  if (lead.websiteStatus === "no_website" || !lead.website) return "border-amber-100 bg-amber-50 text-amber-700";
  if (lead.websiteStatus === "poor_website") return "border-rose-100 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function LeadRow({ lead, selected, onSelect }: {
  lead: Lead;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-4 py-3 border-t border-slate-100 hover:bg-slate-50 transition-colors ${
        selected ? "bg-teal-50/70" : "bg-white"
      }`}
    >
      <div className="hidden md:grid grid-cols-[minmax(220px,1.6fr)_130px_120px_110px_120px_24px] gap-3 items-center">
        <div className="min-w-0">
          <div className="font-bold text-sm text-slate-950 truncate">{lead.businessName}</div>
          <div className="text-xs text-slate-500 truncate">
            {lead.decisionMakerName || "No contact"}{lead.decisionMakerTitle ? `, ${lead.decisionMakerTitle}` : ""}
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
          <div>{opportunityLabel(lead)}</div>
        </div>
        <ChevronRight size={16} className="text-slate-400" />
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
          <span className={`inline-flex border px-2 py-1 rounded-md text-[11px] font-bold ${opportunityTone(lead)}`}>{opportunityLabel(lead)}</span>
        </div>
      </div>
    </button>
  );
}

function LeadDetail({ lead, onSaved }: {
  lead: Lead | null;
  onSaved: (lead: Lead) => void;
}) {
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
        </div>

        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase text-slate-500 mb-2">
            <UserRound size={14} /> Contact
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

export default function LeadsCrmPage() {
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState<CrmData | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [city, setCity] = useState("all");
  const [niche, setNiche] = useState("all");
  const [minScore, setMinScore] = useState("8");
  const [localOnly, setLocalOnly] = useState(false);
  const [noWebsite, setNoWebsite] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("latchly-leads-crm-auth")) {
      setAuthed(true);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        q: query,
        status,
        city,
        niche,
        minScore,
        limit: "150",
      });
      if (localOnly) params.set("local", "1");
      if (noWebsite) params.set("noWebsite", "1");

      const res = await fetch(`/api/admin/latchly-leads?${params.toString()}`);
      const json = await res.json();
      if (res.status === 401) {
        sessionStorage.removeItem("latchly-leads-crm-auth");
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
  }, [city, localOnly, minScore, niche, noWebsite, query, status]);

  useEffect(() => {
    if (authed) fetchData();
  }, [authed, fetchData]);

  const selectedLead = useMemo(() => {
    return data?.leads.find((lead) => lead.id === selectedId) || null;
  }, [data?.leads, selectedId]);

  const handleSaved = (updated: Lead) => {
    setData((current) => {
      if (!current) return current;
      return {
        ...current,
        leads: current.leads.map((lead) => lead.id === updated.id ? updated : lead),
      };
    });
  };

  const logout = async () => {
    await fetch("/api/dashboard/auth", { method: "DELETE" }).catch(() => null);
    sessionStorage.removeItem("latchly-leads-crm-auth");
    setAuthed(false);
  };

  if (!authed) return <AuthGate onAuth={() => setAuthed(true)} />;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-slate-950 text-white flex items-center justify-center font-black shrink-0">L</div>
            <div className="min-w-0">
              <h1 className="text-lg font-black truncate">Leads CRM</h1>
              <p className="text-xs text-slate-500 truncate">Scored home-service opportunities</p>
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
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              <LogOut size={15} />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto px-4 sm:px-6 py-5 space-y-5">
        {data && (
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-9 gap-3">
            <StatTile icon={<Building2 size={15} />} label="Total" value={data.stats.total} />
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

        {data?.latestRun && (
          <section className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <span className="font-black text-slate-950">Run {formatDate(data.latestRun.runDate)}</span>
              <span className="text-slate-600">{data.latestRun.delivered}/{data.latestRun.target} delivered</span>
              <span className="text-slate-600">{data.latestRun.local} local</span>
              <span className="text-slate-600">{data.latestRun.rejected} rejected</span>
              <span className="text-emerald-700 font-semibold">{data.stats.total} in CRM</span>
              <span className={data.latestRun.emailSent ? "text-teal-700 font-semibold" : data.latestRun.dryRun ? "text-amber-700 font-semibold" : "text-slate-500 font-medium"}>
                {data.latestRun.emailSent ? "Email sent" : data.latestRun.dryRun ? "Dry run" : "Email skipped"}
              </span>
            </div>
            {data.latestRun.underTargetReason && (
              <div className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                {data.latestRun.underTargetReason}
              </div>
            )}
          </section>
        )}

        <section className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(220px,1fr)_160px_160px_180px_120px_auto_auto_auto] gap-3 items-center">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search business, contact, phone"
                className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2.5 text-sm outline-none focus:border-teal-500"
              />
            </div>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500 bg-white">
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
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
            <select value={minScore} onChange={(event) => setMinScore(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500 bg-white">
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
              <input type="checkbox" checked={noWebsite} onChange={(event) => setNoWebsite(event.target.checked)} className="sr-only" />
              <Globe size={15} /> No site
            </label>
            <button
              onClick={() => {
                setQuery("");
                setStatus("all");
                setCity("all");
                setNiche("all");
                setMinScore("8");
                setLocalOnly(false);
                setNoWebsite(false);
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
                <span className="text-sm font-black text-slate-950">{data?.leads.length ?? 0} leads</span>
              </div>
              {loading && <Loader2 size={16} className="animate-spin text-slate-500" />}
            </div>
            <div className="hidden md:grid grid-cols-[minmax(220px,1.6fr)_130px_120px_110px_120px_24px] gap-3 px-4 py-2 bg-slate-50 border-t border-slate-100 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <div>Business</div>
              <div>Market</div>
              <div>Status</div>
              <div>Score</div>
              <div>Flags</div>
              <div />
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
                />
              ))
            )}
          </section>

          <LeadDetail lead={selectedLead} onSaved={handleSaved} />
        </div>
      </main>
    </div>
  );
}
