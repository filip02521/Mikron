"use client";

import { cn } from "@/lib/cn";
import type { MomChange } from "@/lib/data/monthly-stats-shared";
import { formatDni, shortMonthLabel } from "@/lib/data/monthly-summary-pl";

const TONE_STYLES: Record<
  string,
  { bg: string; text: string; ring: string; bar: string }
> = {
  indigo: {
    bg: "bg-indigo-50/80",
    text: "text-indigo-700",
    ring: "ring-indigo-200/70",
    bar: "bg-indigo-500",
  },
  emerald: {
    bg: "bg-emerald-50/80",
    text: "text-emerald-700",
    ring: "ring-emerald-200/70",
    bar: "bg-emerald-500",
  },
  amber: {
    bg: "bg-amber-50/80",
    text: "text-amber-700",
    ring: "ring-amber-200/70",
    bar: "bg-amber-500",
  },
  sky: {
    bg: "bg-sky-50/80",
    text: "text-sky-700",
    ring: "ring-sky-200/70",
    bar: "bg-sky-500",
  },
  violet: {
    bg: "bg-violet-50/80",
    text: "text-violet-700",
    ring: "ring-violet-200/70",
    bar: "bg-violet-500",
  },
  slate: {
    bg: "bg-slate-50/80",
    text: "text-slate-700",
    ring: "ring-slate-200/70",
    bar: "bg-slate-400",
  },
};

export type StatTone = keyof typeof TONE_STYLES;

export function MomBadge({
  change,
  previousLabel,
  unit = "%",
  invertColors = false,
}: {
  change: MomChange;
  previousLabel: string;
  /** % = zmiana procentowa; pp = punkty procentowe; dni = różnica dni. */
  unit?: "%" | "pp" | "dni";
  /** true = spadek jest korzystny (np. czas realizacji). */
  invertColors?: boolean;
}) {
  const vs = shortMonthLabel(previousLabel);
  const up = change.delta > 0;
  const down = change.delta < 0;
  const flat = change.delta === 0;

  const good = invertColors ? down : up;
  const bad = invertColors ? up : down;

  if (flat) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md bg-slate-100/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-500"
        title={`Bez zmian względem: ${previousLabel}`}
      >
        bez zmian · {vs}
      </span>
    );
  }

  if (change.pct == null) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
          good ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
        )}
        title={`W ${previousLabel}: 0`}
      >
        <span aria-hidden>{up ? "↑" : "↓"}</span>
        od zera · {vs}
      </span>
    );
  }

  let valueLabel: string;
  if (unit === "pp") {
    valueLabel = `${up ? "+" : ""}${change.delta}\u00a0p.p.`;
  } else if (unit === "dni") {
    valueLabel = `${up ? "+" : "−"}${formatDni(Math.abs(change.delta))}`;
  } else {
    valueLabel = `${up ? "+" : ""}${change.pct}%`;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
        good && "bg-emerald-50 text-emerald-700",
        bad && "bg-amber-50 text-amber-800",
        !good && !bad && "bg-slate-100 text-slate-600"
      )}
      title={`${change.previous} → ${change.current} (względem ${previousLabel})`}
    >
      <span aria-hidden>{up ? "↑" : "↓"}</span>
      {valueLabel}
      <span className="font-medium opacity-70">wzgl. {vs}</span>
    </span>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  tone = "slate",
  progress,
  mom,
  previousLabel,
  momUnit = "%",
  momInvert = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: StatTone;
  progress?: number;
  mom?: MomChange;
  previousLabel?: string;
  momUnit?: "%" | "pp" | "dni";
  momInvert?: boolean;
}) {
  const t = TONE_STYLES[tone] ?? TONE_STYLES.slate;
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl p-3.5 ring-1 ring-inset",
        t.bg,
        t.ring
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn("mt-1.5 text-2xl font-bold tabular-nums leading-none", t.text)}>{value}</p>
      {mom && previousLabel ? (
        <div className="mt-2">
          <MomBadge
            change={mom}
            previousLabel={previousLabel}
            unit={momUnit}
            invertColors={momInvert}
          />
        </div>
      ) : null}
      {hint ? <p className="mt-1.5 text-[11px] leading-snug text-slate-500">{hint}</p> : null}
      {progress != null ? (
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-slate-200/60">
          <div
            className={cn("h-full rounded-full transition-all duration-500", t.bar)}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function SecondaryStat({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  tone?: StatTone;
}) {
  const t = TONE_STYLES[tone] ?? TONE_STYLES.slate;
  return (
    <div className="flex items-baseline justify-between gap-2 rounded-lg bg-slate-50/80 px-3 py-2 ring-1 ring-inset ring-slate-200/70">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={cn("text-sm font-bold tabular-nums", t.text)}>{value}</span>
    </div>
  );
}

/** Pasek udziału w sumie miesiąca (nie względem lidera). */
export function ShareBar({
  sharePct,
  barClassName,
  showLabel = true,
}: {
  sharePct: number;
  barClassName: string;
  showLabel?: boolean;
}) {
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barClassName)}
          style={{ width: `${Math.min(100, Math.max(0, sharePct))}%` }}
        />
      </div>
      {showLabel ? (
        <span className="shrink-0 text-[10px] tabular-nums text-slate-500">{sharePct}%</span>
      ) : null}
    </div>
  );
}

export function SectionHeading({
  title,
  icon,
  iconClassName,
  bare = false,
}: {
  title: string;
  icon: string;
  iconClassName: string;
  /** Bez obramowania i paddingu — gdy nagłówek jest w osobnym flex-row. */
  bare?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2",
        !bare && "border-b border-slate-100 px-4 py-3"
      )}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={iconClassName}
        aria-hidden
      >
        <path d={icon} />
      </svg>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
    </div>
  );
}
