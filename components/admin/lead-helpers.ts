import type { Lead } from "./types";
import { STATUS_OPTIONS } from "./types";

export function statusTone(status: string) {
  return STATUS_OPTIONS.find(option => option.value === status)?.tone
    || "bg-slate-100 text-slate-700 border-slate-200";
}

export function statusLabel(status: string) {
  return STATUS_OPTIONS.find(option => option.value === status)?.label || status;
}

export function tierTone(tier: string) {
  return tier === "premium"
    ? "border-red-200 bg-red-50 text-red-800"
    : "border-slate-200 bg-white text-slate-600";
}

export function tierLabel(tier: string) {
  return tier === "premium" ? "Premium" : "Standard";
}

// Bare YYYY-MM-DD parses as UTC midnight, which renders one day earlier
// in user-local timezones. Treat date-only strings as local-noon to dodge
// the offset entirely. Full ISO datetimes (with T) keep their UTC instant.
export function formatDate(value?: string | null) {
  if (!value) return "-";
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

export function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function toDateInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function websiteHref(website: string) {
  if (!website) return "";
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

export function opportunityLabel(lead: Pick<Lead, "website" | "websiteStatus">) {
  if (lead.websiteStatus === "no_website" || !lead.website) return "No Website";
  if (lead.websiteStatus === "poor_website") return "Poor Website";
  return "Website";
}

export function opportunityTone(lead: Pick<Lead, "website" | "websiteStatus">) {
  if (lead.websiteStatus === "no_website" || !lead.website) return "border-amber-100 bg-amber-50 text-amber-700";
  if (lead.websiteStatus === "poor_website") return "border-rose-100 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function qualityChipTone(score: number) {
  if (score >= 90) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (score >= 80) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

export function outreachStatusTone(status: string | undefined | null) {
  switch (status) {
    case "draft":           return "border-violet-100 bg-violet-50 text-violet-700";
    case "queued":          return "border-blue-100 bg-blue-50 text-blue-700";
    case "sending":         return "border-amber-100 bg-amber-50 text-amber-700";
    case "day_zero_sent":   return "border-emerald-100 bg-emerald-50 text-emerald-700";
    case "day_zero_failed": return "border-rose-100 bg-rose-50 text-rose-700";
    case "rejected":        return "border-zinc-200 bg-zinc-50 text-zinc-700";
    case "no_email":
    case "no_demo":         return "border-slate-100 bg-slate-50 text-slate-600";
    case "unsubscribed":    return "border-zinc-200 bg-zinc-50 text-zinc-700";
    default:                return "border-slate-100 bg-slate-50 text-slate-600";
  }
}

export function outreachStatusLabel(lead: Lead) {
  switch (lead.outreachStatus) {
    case "queued": {
      const t = lead.outreachScheduledFor;
      if (!t) return "Queued";
      const d = new Date(t);
      if (Number.isNaN(d.getTime())) return "Queued";
      const local = d.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" });
      return `Queued · ${local}`;
    }
    case "draft": return "Draft — awaiting approval";
    case "rejected": return "Rejected";
    case "sending": return "Sending…";
    case "day_zero_sent": {
      const t = lead.emailSentAt;
      if (!t) return "Sent";
      const d = new Date(t);
      if (Number.isNaN(d.getTime())) return "Sent";
      return `Sent ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
    }
    case "day_zero_failed": return "Send failed";
    case "no_email":        return "No email";
    case "no_demo":         return "No demo";
    case "unsubscribed":    return "Unsubscribed";
    default:                return lead.outreachStatus || "";
  }
}

export function contactSummary(lead: Pick<Lead, "decisionMakerName" | "decisionMakerTitle" | "phone" | "email">) {
  if (lead.decisionMakerName) {
    return `${lead.decisionMakerName}${lead.decisionMakerTitle ? `, ${lead.decisionMakerTitle}` : ""}`;
  }
  if (lead.email) return lead.email;
  if (lead.phone) return `Phone: ${lead.phone}`;
  return "No contact";
}

// Used to drive the Cold Email "Queued for tomorrow" / "Sent today" buckets.
// Returns a relative human-readable countdown ("in 13h 27m") or an empty
// string if value is null or in the past.
export function timeUntil(value?: string | null) {
  if (!value) return "";
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) return "";
  const diff = target - Date.now();
  if (diff <= 0) return "due now";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  if (hours < 48) return remMin ? `in ${hours}h ${remMin}m` : `in ${hours}h`;
  const days = Math.floor(hours / 24);
  return `in ${days}d`;
}

// Group rows by the calendar day of an ISO timestamp. Returns ordered groups
// (oldest day first) so the Cold Email page can list "Tomorrow", "Friday",
// "next Monday" etc. predictably.
export function groupByDay<T>(rows: T[], pickDate: (row: T) => string | null | undefined) {
  const buckets = new Map<string, T[]>();
  for (const row of rows) {
    const value = pickDate(row);
    if (!value) continue;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(row);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, items]) => ({ key, label: friendlyDayLabel(key), items }));
}

function friendlyDayLabel(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 1 && diffDays <= 7) return date.toLocaleDateString(undefined, { weekday: "long" });
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
