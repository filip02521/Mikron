import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type AdminMetric = {
  label: string;
  value: ReactNode;
  hint?: string;
  /** Ton barwi tylko liczbę i tylko gdy wymaga działania (DESIGN.md → „Stan to nie dekoracja”). */
  tone?: "default" | "success" | "warning" | "danger";
  /** Wartość jako przycisk — np. ustawia filtr tabeli pod spodem. */
  onClick?: () => void;
  actionLabel?: string;
};

const COLS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
  5: "sm:grid-cols-3 lg:grid-cols-5",
  6: "sm:grid-cols-3 lg:grid-cols-6",
};

/**
 * Wskaźniki wewnątrz karty — rząd wartości bez ramek (DESIGN.md → Cards: bez kafelków w karcie).
 */
export function AdminMetrics({ items, className }: { items: AdminMetric[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-2 gap-x-6 gap-y-3", COLS[items.length] ?? "sm:grid-cols-4", className)}>
      {items.map((m) => (
        <div key={m.label} className="min-w-0">
          <dt className="text-[0.6875rem] font-medium text-slate-500">{m.label}</dt>
          <dd
            className={cn(
              "mt-0.5 text-lg font-semibold tabular-nums tracking-tight",
              m.tone === "danger" ? "text-red-700" : m.tone === "warning" ? "text-amber-700" : "text-slate-900"
            )}
          >
            {m.onClick ? (
              <button
                type="button"
                onClick={m.onClick}
                aria-label={m.actionLabel}
                className="rounded-md underline decoration-slate-300 underline-offset-4 transition-colors hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                {m.value}
              </button>
            ) : (
              m.value
            )}
          </dd>
          {m.hint ? <dd className="text-[0.6875rem] leading-snug text-slate-600">{m.hint}</dd> : null}
        </div>
      ))}
    </dl>
  );
}
