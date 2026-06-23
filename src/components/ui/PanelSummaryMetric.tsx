import { cn } from "@/lib/cn";

export type PanelSummaryMetricTone = "default" | "success" | "warning" | "danger";

export function PanelSummaryMetric({
  label,
  value,
  hint,
  tone = "default",
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: PanelSummaryMetricTone;
  className?: string;
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200/80 bg-emerald-50/40"
      : tone === "warning"
        ? "border-amber-200/80 bg-amber-50/40"
        : tone === "danger"
          ? "border-red-200/80 bg-red-50/40"
          : "border-slate-200/90 bg-slate-50/50";

  return (
    <div className={cn("rounded-md border px-3 py-2.5", toneClass, className)}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] leading-snug text-slate-600">{hint}</p> : null}
    </div>
  );
}
