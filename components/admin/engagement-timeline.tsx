"use client";

import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Eye,
  MailCheck,
  MousePointerClick,
  Reply,
} from "lucide-react";
import { formatDateTime } from "@/components/admin/lead-helpers";

export interface EngagementEvent {
  id: number;
  eventType: string;
  occurredAt: string;
  linkUrl?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  rawSource?: string | null;
}

export function EngagementTimeline({
  events,
  loading = false,
  emptyText = "No engagement yet.",
  compact = false,
}: {
  events: EngagementEvent[];
  loading?: boolean;
  emptyText?: string;
  compact?: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-4 text-xs font-semibold text-slate-500">
        Loading activity...
      </div>
    );
  }

  if (!events.length) {
    return (
      <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-4 text-xs text-slate-500">
        {emptyText}
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-2.5"}>
      {events.map((event) => {
        const meta = eventMeta(event.eventType);
        return (
          <div
            key={event.id}
            className="rounded-lg border border-slate-100 bg-white px-3 py-2.5"
          >
            <div className="flex items-start gap-2.5">
              <span className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${meta.tone}`}>
                {meta.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-xs font-black text-slate-900">{meta.label}</span>
                  {event.rawSource === "manual_mark" && (
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                      manual
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[11px] font-semibold text-slate-500">
                  {formatDateTime(event.occurredAt)}
                </div>
                {event.linkUrl && (
                  <div className="mt-1 truncate text-[11px] text-violet-700">
                    {event.linkUrl}
                  </div>
                )}
                {!compact && (event.ip || event.userAgent) && (
                  <div className="mt-1 truncate text-[10px] text-slate-400">
                    {[event.ip, event.userAgent].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function eventMeta(eventType: string) {
  switch (eventType) {
    case "sent":
      return { label: "Sent", icon: <MailCheck size={14} />, tone: "bg-blue-50 text-blue-700" };
    case "delivered":
      return { label: "Delivered", icon: <CheckCircle2 size={14} />, tone: "bg-emerald-50 text-emerald-700" };
    case "opened":
      return { label: "Opened", icon: <Eye size={14} />, tone: "bg-teal-50 text-teal-700" };
    case "clicked":
      return { label: "Clicked", icon: <MousePointerClick size={14} />, tone: "bg-violet-50 text-violet-700" };
    case "bounced":
      return { label: "Bounced", icon: <AlertTriangle size={14} />, tone: "bg-rose-50 text-rose-700" };
    case "complained":
      return { label: "Complaint", icon: <Ban size={14} />, tone: "bg-red-50 text-red-700" };
    case "unsubscribed":
      return { label: "Unsubscribed", icon: <Ban size={14} />, tone: "bg-zinc-100 text-zinc-700" };
    case "replied":
      return { label: "Replied", icon: <Reply size={14} />, tone: "bg-amber-50 text-amber-700" };
    case "delivery_delayed":
      return { label: "Delivery delayed", icon: <Clock size={14} />, tone: "bg-amber-50 text-amber-700" };
    case "failed":
    case "delivery_error":
      return { label: "Delivery failed", icon: <AlertTriangle size={14} />, tone: "bg-rose-50 text-rose-700" };
    default:
      return { label: eventType || "Event", icon: <Clock size={14} />, tone: "bg-slate-100 text-slate-700" };
  }
}
