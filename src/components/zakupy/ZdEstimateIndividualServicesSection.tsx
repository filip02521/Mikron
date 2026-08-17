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
import { zdEstimateProsbaWord } from "@/lib/orders/zd-estimate-ui-copy";
import { IconChevronDown } from "@/components/icons/StrokeIcons";
import { zdEstimateRadiusSurfaceClass } from "@/lib/ui/ontime-theme";

const REASON_CHIP: Record<
  ZdEstimateIndividualServiceReason,
  string
> = {
  no_subiekt: "bg-slate-100 text-slate-800 ring-slate-200/80",
  fetch_failed: "bg-amber-50 text-amber-950 ring-amber-200/80",
  bom_parent: "bg-indigo-50 text-indigo-950 ring-indigo-200/80",
  bom_component_not_purchased: "bg-rose-50 text-rose-950 ring-rose-200/80",
  bom_explode_incomplete: "bg-amber-50 text-amber-950 ring-amber-200/80",
  teeth: "bg-sky-50 text-sky-950 ring-sky-200/80",
  excluded: "bg-amber-100/90 text-amber-950 ring-amber-300/60",
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
  const [expanded, setExpanded] = useState(false);

  if (!serviceLines.length) return null;

  const uniqueReasons = [
    ...new Set(serviceLines.map((l) => l.reason)),
  ] as ZdEstimateIndividualServiceReason[];

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

  const n = serviceLines.length;
  const title = `Usługi (${n})`;

  return (
    <section
      id={ZD_ESTIMATE_SERVICES_FOCUS_ID}
      className={cn(
        "scroll-mt-4 bg-gradient-to-b from-amber-50/70 to-amber-50/35 p-2 ring-1 ring-amber-200/65",
        zdEstimateRadiusSurfaceClass,
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              className="inline-flex h-8 min-w-0 items-center gap-1.5 rounded-md px-1 text-left transition hover:bg-amber-100/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
            >
              <IconChevronDown
                size={15}
                strokeWidth={2}
                className={cn(
                  "shrink-0 text-amber-800/75 transition-transform duration-150",
                  expanded && "rotate-180"
                )}
              />
              <h3 className="text-[13px] font-semibold leading-none tracking-tight text-slate-900">
                {title}
              </h3>
            </button>
            {!expanded ? (
              <div className="flex flex-wrap gap-1">
                {uniqueReasons.map((reason) => (
                  <span
                    key={reason}
                    className={cn(
                      "rounded-md px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset",
                      REASON_CHIP[reason]
                    )}
                  >
                    {individualServiceReasonLabel(reason)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          {expanded ? (
            <p className="mt-1 text-[11px] leading-snug text-slate-600">
              Trafią do uwag ZD (nie jako towar). Po utworzeniu ZD w panelu na tej
              stronie zdecydujesz, czy odznaczyć je jako Główne (oprócz pozycji
              zębowych).
            </p>
          ) : null}
          {excludedRoutedCount > 0 ? (
            <p className="mt-1.5 rounded-md bg-amber-100/80 px-2 py-1 text-[11px] leading-snug text-amber-950 ring-1 ring-inset ring-amber-200/70">
              {excludedRoutedCount}{" "}
              {zdEstimateProsbaWord(excludedRoutedCount)}{" "}
              {excludedRoutedCount === 1
                ? "z wykluczonej pozycji"
                : "z wykluczonych pozycji"}{" "}
              — bez ilości towaru, tylko w uwagach.
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8 shrink-0 px-2.5 py-0 text-xs leading-none"
          onClick={copyAll}
        >
          {copyState === "ok"
            ? "Skopiowano"
            : copyState === "fail"
              ? "Nie udało się"
              : "Kopiuj listę"}
        </Button>
      </div>

      {catalogOrderableCount <= 0 ? (
        <p className="mt-1.5 rounded-md bg-amber-100/85 px-2.5 py-1.5 text-[11px] leading-snug text-amber-950 ring-1 ring-inset ring-amber-300/50">
          Samymi usługami nie utworzysz ZD w OnTime — potrzebna jest choć jedna
          pozycja katalogowa. Skopiuj listę albo obsłuż prośby w panelu Dziś.
        </p>
      ) : null}

      {expanded ? (
        <ul className="mt-2 max-h-[8rem] divide-y divide-amber-100/90 overflow-y-auto overscroll-contain rounded-md bg-white/40 ring-1 ring-amber-100/80">
          {serviceLines.map((line) => (
            <li
              key={line.key}
              className="flex flex-wrap items-baseline justify-between gap-2 px-2 py-1.5 text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium leading-snug text-slate-900">
                  {line.label}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
                  <span className="truncate">
                    {line.requests.map((r) => r.salesPersonName).join(", ")}
                  </span>
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset",
                      REASON_CHIP[line.reason]
                    )}
                  >
                    {individualServiceReasonLabel(line.reason)}
                  </span>
                </div>
              </div>
              <div className="text-[13px] font-semibold tabular-nums text-slate-800">
                {formatQty(line.qty)} szt
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
