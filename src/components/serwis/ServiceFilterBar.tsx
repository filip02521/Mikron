"use client";

import { cn } from "@/lib/cn";
import { controlFocusClass } from "@/lib/ui/ontime-theme";
import { serwisFilterActiveClass, serwisFilterIdleClass } from "@/lib/ui/serwis-theme";

export type ServiceFilterOption<T extends string> = {
  id: T;
  label: string;
  count: number;
  /** Klasa kropki stanu (tabela Stany): `bg-amber-500`, `bg-red-600`…; bez kropki, gdy grupa łączy kilka stanów. */
  dot?: string;
  /** Co liczy filtr — w dymku, bo etykieta ma zostać krótka. */
  hint?: string;
};

/**
 * Filtry Serwisu: jeden rząd kontrolek „kropka · licznik · nazwa”, klik włącza i wyłącza filtr
 * (DESIGN-serwis.md → Filtry). Od `sm` zawija się, na telefonie przewija w bok w jednym rzędzie.
 */
export function ServiceFilterBar<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: ServiceFilterOption<T>[];
  value: T | null;
  onChange: (next: T | null) => void;
  className?: string;
}) {
  return (
    // Na telefonie jeden rząd przewijany w bok (jak przełącznik segmentowy) — filtry nie spychają listy pod dolny pasek.
    <div
      role="group"
      aria-label={label}
      className={cn("-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0", className)}
    >
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            title={o.hint}
            onClick={() => onChange(active ? null : o.id)}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors duration-150",
              controlFocusClass,
              active ? serwisFilterActiveClass : serwisFilterIdleClass,
              o.count === 0 && !active && "text-slate-500"
            )}
          >
            {o.dot ? <span className={cn("h-2 w-2 rounded-full", o.dot, o.count === 0 && "opacity-40")} aria-hidden /> : null}
            <span className="font-semibold tabular-nums">{o.count}</span>
            <span className="whitespace-nowrap">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
