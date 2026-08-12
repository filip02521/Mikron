"use client";

import { useState } from "react";
import {
  individualServiceReasonLabel,
  type ZdEstimateIndividualServiceLine,
  type ZdEstimateIndividualServiceReason,
} from "@/lib/orders/zd-estimate-individual";
import { formatQty } from "@/lib/orders/zd-estimate-manual";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { ZD_ESTIMATE_SERVICES_FOCUS_ID } from "@/lib/orders/zd-estimate-launch-scroll";

const REASON_CHIP: Record<
  ZdEstimateIndividualServiceReason,
  string
> = {
  no_subiekt: "bg-slate-200/80 text-slate-800",
  fetch_failed: "bg-amber-100 text-amber-950",
  bom_parent: "bg-indigo-100 text-indigo-950",
  bom_component_not_purchased: "bg-rose-100 text-rose-950",
  bom_explode_incomplete: "bg-amber-100 text-amber-950",
  teeth: "bg-sky-100 text-sky-950",
  excluded: "bg-amber-200/80 text-amber-950",
};

export function ZdEstimateIndividualServicesSection({
  serviceLines,
  catalogOrderableCount,
  excludedRoutedCount = 0,
  className,
}: {
  serviceLines: readonly ZdEstimateIndividualServiceLine[];
  catalogOrderableCount: number;
  /** Ile usług powstało z wykluczonych pozycji (info w nagłówku). */
  excludedRoutedCount?: number;
  className?: string;
}) {
  const [copyState, setCopyState] = useState<"idle" | "ok" | "fail">("idle");

  if (!serviceLines.length) return null;

  const copyAll = async () => {
    const text = serviceLines
      .map(
        (l) =>
          `${l.requests.map((r) => r.salesPersonName).join(", ")} · ${formatQty(l.qty)} szt · ${l.label}`
      )
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("ok");
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("fail");
      window.setTimeout(() => setCopyState("idle"), 2500);
    }
  };

  return (
    <section
      id={ZD_ESTIMATE_SERVICES_FOCUS_ID}
      className={cn(
        "scroll-mt-4 rounded-xl border border-amber-200/80 bg-amber-50/40 p-4",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">
            Usługi jednorazowe (prośby)
          </h3>
          <p className="mt-0.5 text-xs leading-snug text-slate-600">
            Trafią do uwag ZD (nie jako towar). Po udanym create — Główne
            (oprócz pozycji zębowych).
          </p>
          {excludedRoutedCount > 0 ? (
            <p className="mt-2 rounded-md bg-amber-100/90 px-2.5 py-1.5 text-xs text-amber-950">
              {excludedRoutedCount}{" "}
              {excludedRoutedCount === 1
                ? "prośba z wykluczonej pozycji"
                : "próśb z wykluczonych pozycji"}{" "}
              — bez qty towaru, tylko w uwagach.
            </p>
          ) : null}
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={copyAll}>
          {copyState === "ok"
            ? "Skopiowano"
            : copyState === "fail"
              ? "Nie udało się"
              : "Kopiuj listę"}
        </Button>
      </div>

      {catalogOrderableCount <= 0 ? (
        <p className="mt-3 rounded-lg bg-amber-100/80 px-3 py-2 text-xs text-amber-950">
          Samymi usługami nie utworzysz ZD w OnTime — potrzebna jest choć jedna
          pozycja katalogowa. Skopiuj listę albo obsłuż prośby w panelu Dziś.
        </p>
      ) : null}

      <ul className="mt-3 divide-y divide-amber-100/80">
        {serviceLines.map((line) => (
          <li
            key={line.key}
            className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium leading-snug text-slate-900">
                {line.label}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                <span className="truncate">
                  {line.requests.map((r) => r.salesPersonName).join(", ")}
                </span>
                <span
                  className={cn(
                    "rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide",
                    REASON_CHIP[line.reason]
                  )}
                >
                  {individualServiceReasonLabel(line.reason)}
                </span>
              </div>
            </div>
            <div className="tabular-nums font-semibold text-slate-800">
              {formatQty(line.qty)} szt
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
