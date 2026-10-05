import * as ProgressPrimitive from "@radix-ui/react-progress";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function ProgressBar({ value, label, tone = "sea" }: { value: number; label: string; tone?: "sea" | "amber" | "red" | "navy" }) {
  const v = Math.max(0, Math.min(100, value));
  const color = { sea: "bg-sea-500", amber: "bg-signal-amber", red: "bg-signal-red", navy: "bg-navy-700" }[tone];
  return (
    <ProgressPrimitive.Root value={v} aria-label={label} className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
      <ProgressPrimitive.Indicator className={`h-full ${color} transition-all`} style={{ width: `${v}%` }} />
    </ProgressPrimitive.Root>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function PageHeader({ title, back, right }: { title: string; back?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      {back && (
        <Link to={back} className="btn-ghost !min-h-[40px] !px-3" aria-label="Back">
          ←
        </Link>
      )}
      <h1 className="h1 flex-1">{title}</h1>
      {right}
    </div>
  );
}

export function DraftBadge({ status }: { status: string }) {
  if (status === "reviewed") return <span className="chip bg-emerald-100 text-emerald-800">Reviewed</span>;
  return (
    <span className="chip bg-amber-100 text-amber-900" title="Original practice content awaiting expert review">
      Draft
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card text-center text-slate-600">{children}</div>;
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-600">{label}</div>
      <div className="text-2xl font-bold text-navy-800">{value}</div>
      {sub && <div className="text-xs text-slate-600">{sub}</div>}
    </div>
  );
}

export function Banner({ tone = "info", children }: { tone?: "info" | "warn" | "ok"; children: ReactNode }) {
  const cls = {
    info: "bg-navy-50 text-navy-800 ring-navy-100",
    warn: "bg-amber-50 text-amber-900 ring-amber-200",
    ok: "bg-emerald-50 text-emerald-900 ring-emerald-200",
  }[tone];
  return (
    <div role="status" className={`mb-3 rounded-xl px-3 py-2 text-sm ring-1 ${cls}`}>
      {children}
    </div>
  );
}
