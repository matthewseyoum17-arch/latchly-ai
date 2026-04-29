import type { ReactNode } from "react";

interface StatTileProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  tone?: string;
}

export function StatTile({ icon, label, value, sub, tone }: StatTileProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 min-w-0">
      <div className={`flex items-center gap-2 mb-2 ${tone || "text-slate-500"}`}>
        {icon}
        <span className="text-[11px] font-bold uppercase tracking-wide truncate">{label}</span>
      </div>
      <div className="text-2xl font-black text-slate-950">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1 truncate">{sub}</div>}
    </div>
  );
}

interface StatPillProps {
  icon: ReactNode;
  label: string;
  value: number;
  tone: string;
}

// Compact variant used in the Cold Email page where 8 outreach stats need
// to fit on a single row without overwhelming the dashboard.
export function StatPill({ icon, label, value, tone }: StatPillProps) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
      <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide ${tone}`}>
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="text-xl font-black text-slate-950 mt-0.5">{value}</div>
    </div>
  );
}
