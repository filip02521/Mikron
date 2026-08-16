"use client";

import {
  individualServiceReasonLabel,
  type ZdEstimateIndividualServiceReason,
} from "@/lib/orders/zd-estimate-individual";
import { formatQty } from "@/lib/orders/zd-estimate-manual";
import type {
  ZdPostCreateRequestSnap,
  ZdPostCreateServiceSnap,
} from "@/lib/orders/zd-estimate-post-create";
import { cn } from "@/lib/cn";
import { panelTypography } from "@/lib/ui/ontime-theme";

const REASON_CHIP: Record<ZdEstimateIndividualServiceReason, string> = {
  no_subiekt: "bg-slate-200/80 text-slate-800",
  fetch_failed: "bg-amber-100 text-amber-950",
  bom_parent: "bg-indigo-100 text-indigo-950",
  bom_component_not_purchased: "bg-rose-100 text-rose-950",
  bom_explode_incomplete: "bg-amber-100 text-amber-950",
  teeth: "bg-sky-100 text-sky-950",
  excluded: "bg-amber-200/80 text-amber-950",
};

export function ZdEstimateCreateRequestsPreview({
  catalogRequests,
  serviceLines,
  glowneCatalogCount,
  glowneServiceCount,
  constrainHeight = true,
}: {
  catalogRequests: readonly ZdPostCreateRequestSnap[];
  serviceLines: readonly ZdPostCreateServiceSnap[];
  glowneCatalogCount?: number;
  glowneServiceCount?: number;
  /** Panel: wewnętrzny scroll. Create: pełna lista w scrollu modala. */
  constrainHeight?: boolean;
}) {
  if (!catalogRequests.length && !serviceLines.length) return null;

  return (
    <div className="space-y-3">
      {catalogRequests.length > 0 ? (
        <section className="rounded-lg border border-emerald-200/80 bg-emerald-50/40">
          <div className="border-b border-emerald-100 px-3 py-2">
            <h3 className={cn(panelTypography.sectionLabel, "text-emerald-950")}>
              Prośby katalogowe na ZD ({catalogRequests.length})
            </h3>
            {glowneCatalogCount != null ? (
              <p className="mt-0.5 text-[11px] text-emerald-900/80">
                {glowneCatalogCount} do ewentualnego Główne po utworzeniu
              </p>
            ) : null}
          </div>
          <ul
            className={cn(
              "divide-y divide-emerald-100/80",
              constrainHeight && "max-h-56 overflow-y-auto"
            )}
          >
            {catalogRequests.map((r) => (
              <li
                key={r.orderId}
                className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">
                    {r.symbol || r.products || "Prośba"}
                  </p>
                  <p className="text-xs text-slate-600">
                    {r.salesPersonName}
                    {r.requestNote ? ` · ${r.requestNote}` : ""}
                  </p>
                </div>
                <span className="tabular-nums text-slate-800">
                  {formatQty(r.qty)} szt
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {serviceLines.length > 0 ? (
        <section className="rounded-lg border border-amber-200/80 bg-amber-50/40">
          <div className="border-b border-amber-100 px-3 py-2">
            <h3 className={cn(panelTypography.sectionLabel, "text-amber-950")}>
              Usługi jednorazowe ({serviceLines.length})
            </h3>
            {glowneServiceCount != null ? (
              <p className="mt-0.5 text-[11px] text-amber-900/80">
                {glowneServiceCount} w uwagach do ewentualnego Główne (zęby
                pominięte)
              </p>
            ) : null}
          </div>
          <ul
            className={cn(
              "divide-y divide-amber-100/80",
              constrainHeight && "max-h-56 overflow-y-auto"
            )}
          >
            {serviceLines.map((line) => (
              <li key={line.key} className="px-3 py-2 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="min-w-0 font-medium text-slate-900">
                    {line.label}
                  </p>
                  <span className="tabular-nums text-slate-800">
                    {formatQty(line.qty)} szt
                  </span>
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                      REASON_CHIP[line.reason]
                    )}
                  >
                    {individualServiceReasonLabel(line.reason)}
                  </span>
                  <span>
                    {line.requests.map((r) => r.salesPersonName).join(", ")}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
