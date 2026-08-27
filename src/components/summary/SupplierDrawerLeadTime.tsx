"use client";

import { IconTruck } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import {
  buildSupplierDrawerLeadTime,
  type SupplierDrawerLeadTimePart,
} from "@/lib/orders/delivery-eta";
import type { DeliveryStats, StatsMode } from "@/types/database";

/**
 * Subtelna karta średniego czasu dostawy w podglądzie dostawcy.
 * Waga zbliżona do DateCard / Field — bez dużego „hero” numeru.
 */
export function SupplierDrawerLeadTime({
  stats,
  statsMode,
  className,
  leadTimeDisplay,
}: {
  stats: DeliveryStats | null | undefined;
  statsMode: StatsMode;
  className?: string;
  leadTimeDisplay?: import("@/lib/orders/delivery-eta").LeadTimeDisplayOptions;
}) {
  const model = buildSupplierDrawerLeadTime(stats, statsMode, leadTimeDisplay);

  return (
    <section
      className={cn(
        "rounded-lg border border-slate-200/70 bg-white px-3 py-2.5",
        className
      )}
      aria-label={model.title}
    >
      <div className="flex items-center gap-1.5">
        <IconTruck size={14} className="shrink-0 text-slate-400" />
        <h3 className="text-xs text-slate-500">{model.title}</h3>
        {model.kind !== "empty" && model.lowConfidence ? (
          <span
            className="ml-auto text-[10px] font-medium text-amber-700/90"
            title={model.footnote ?? undefined}
          >
            szacunek
          </span>
        ) : null}
      </div>

      {model.kind === "empty" ? (
        <p className="mt-1 text-sm leading-snug text-slate-500">{model.detail}</p>
      ) : null}

      {model.kind === "combined" ? (
        <div className="mt-1">
          <p className="text-sm font-semibold tabular-nums text-slate-900">
            {model.primary.avgDisplay}{" "}
            <span className="font-medium text-slate-600">
              {model.primary.unitLabel}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {model.sampleLabel}
            <span className="text-slate-300"> · </span>
            tryb {model.modeLabel}
          </p>
        </div>
      ) : null}

      {model.kind === "split" ? (
        <div className="mt-1.5 space-y-1.5">
          <div className="grid grid-cols-2 gap-2">
            <SplitStat label="Główne" part={model.main} />
            <SplitStat label="Poboczne" part={model.side} />
          </div>
          <p className="text-xs text-slate-500">
            {model.sampleLabel}
            <span className="text-slate-300"> · </span>
            tryb {model.modeLabel}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function SplitStat({
  label,
  part,
}: {
  label: string;
  part: SupplierDrawerLeadTimePart | null;
}) {
  return (
    <div className="rounded-md bg-slate-50/70 px-2.5 py-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      {part ? (
        <>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-800">
            {part.avgDisplay}{" "}
            <span className="text-[11px] font-medium text-slate-500">
              {part.unitLabel}
            </span>
          </p>
          <p className="text-[10px] text-slate-400">{part.sampleLabel}</p>
        </>
      ) : (
        <p className="mt-0.5 text-xs text-slate-400">Brak danych</p>
      )}
    </div>
  );
}
