// Shared admin types. Both /admin/leads-crm and /admin/cold-email read the
// same /api/admin/latchly-leads response, just with different filters and
// projections. Keep the source of truth here so the two pages can't drift.

export type CrmStatus =
  | "new"
  | "reviewed"
  | "contacted"
  | "interested"
  | "follow_up"
  | "not_fit"
  | "won"
  | "lost";

export type OutreachStatus =
  | "none"
  | "draft"
  | "queued"
  | "sending"
  | "day_zero_sent"
  | "day_zero_failed"
  | "rejected"
  | "unsubscribed"
  | "no_email"
  | "no_demo";

export interface Lead {
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
  tier: "premium" | "standard";
  signalCount: number;
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
  placeId?: string | null;
  demoSlug?: string | null;
  demoUrl?: string | null;
  demoDirection?: string | null;
  demoQualityScore?: number | null;
  demoBuiltAt?: string | null;
  outreachStatus?: OutreachStatus | string;
  outreachStep?: number;
  emailSubject?: string | null;
  emailBodyPreview?: string | null;
  outreachQueuedAt?: string | null;
  outreachScheduledFor?: string | null;
  emailSentAt?: string | null;
  lastResendEmailId?: string | null;
  outreachError?: string | null;
  enrichmentSummary?: {
    ownerFirstName?: string | null;
    ownerName?: string | null;
    yearsInBusiness?: number | null;
    averageRating?: number | null;
    reviewCount?: number | null;
    topReview?: { author?: string; text?: string; rating?: number } | null;
    bbbRating?: string | null;
    servicesVerified?: string[];
  } | null;
}

export interface OutreachStats {
  draft: number;
  queued: number;
  sending: number;
  sent: number;
  sentToday: number;
  failed: number;
  rejected: number;
  unsubscribed: number;
}

export interface CrmStats {
  total: number;
  new: number;
  contacted: number;
  active: number;
  won: number;
  lost: number;
  premium: number;
  standard: number;
  highScore: number;
  local: number;
  noWebsite: number;
  poorWebsite: number;
  dueFollowUp: number;
  avgScore: number | null;
  outreach?: OutreachStats;
  // Coverage gauges, populated once the API is extended (Phase 3C).
  withEmail?: number;
  withOwner?: number;
}

export interface CrmRunSummary {
  id?: number;
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
  status: string;
  metadata?: Record<string, any>;
  premiumDelivered?: number;
  standardDelivered?: number;
  createdAt: string;
}

export interface CrmData {
  leads: Lead[];
  stats: CrmStats;
  statusCounts: { status: CrmStatus; count: number }[];
  filters: {
    cities: { city: string; count: number }[];
    niches: { niche: string; count: number }[];
  };
  latestRun: CrmRunSummary | null;
}

// Single-source-of-truth status options. Used by both the CRM page tabs and
// the LeadDetail dropdown so a label change here propagates everywhere.
export const STATUS_OPTIONS: { value: CrmStatus; label: string; tone: string }[] = [
  { value: "new",         label: "New",        tone: "bg-sky-50 text-sky-700 border-sky-100" },
  { value: "reviewed",    label: "Reviewed",   tone: "bg-slate-100 text-slate-700 border-slate-200" },
  { value: "contacted",   label: "Contacted",  tone: "bg-blue-50 text-blue-700 border-blue-100" },
  { value: "interested",  label: "Interested", tone: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  { value: "follow_up",   label: "Follow Up",  tone: "bg-amber-50 text-amber-800 border-amber-100" },
  { value: "not_fit",     label: "Not Fit",    tone: "bg-zinc-100 text-zinc-700 border-zinc-200" },
  { value: "won",         label: "Won",        tone: "bg-teal-50 text-teal-800 border-teal-100" },
  { value: "lost",        label: "Lost",       tone: "bg-rose-50 text-rose-700 border-rose-100" },
];
