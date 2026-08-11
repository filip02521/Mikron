"use client";

import { useMemo } from "react";
import { IconTruck } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import {
  buildProsbaFormLeadTimeMeta,
  PROSBA_FORM_LEAD_TIME_LABEL,
  PROSBA_FORM_LEAD_TIME_UNDER_LINK_PREFIX,
  type ProsbaFormLeadTimeMeta,
} from "@/lib/orders/prosba-form-lead-time";
import type { OrderFormSupplierOption } from "@/lib/orders/order-form-suppliers";
import type { DeliveryStats } from "@/types/database";

type LeadTimeRow = {
  supplierId: string;
  supplierName: string | null;
  meta: ProsbaFormLeadTimeMeta;
};

/**
 * Subtelna meta średniego czasu dostawy przy znanym dostawcy na formularzu prośby.
 * `underLink` — pod „Powiązano z Subiektem” / „Z bazy” (hint, bez osobnego nagłówka).
 */
export function ProsbaSupplierLeadTimeMeta({
  supplierIds,
  suppliers,
  statsBySupplierId,
  showSupplierNames = false,
  variant = "default",
  className,
}: {
  supplierIds: string[];
  suppliers: OrderFormSupplierOption[];
  statsBySupplierId: Record<string, DeliveryStats>;
  /** Gdy kilka dostawców albo brak widocznego pickera (sales). */
  showSupplierNames?: boolean;
  /**
   * `default` — przy polu dostawcy / banerze harmonogramu.
   * `underLink` — bezpośrednio pod statusem powiązania produktu.
   */
  variant?: "default" | "underLink";
  className?: string;
}) {
  const rows = useMemo(() => {
    const out: LeadTimeRow[] = [];
    for (const id of supplierIds) {
      const supplier = suppliers.find((s) => s.id === id);
      const meta = buildProsbaFormLeadTimeMeta(
        statsBySupplierId[id],
        supplier?.stats_mode ?? "LACZNIE"
      );
      if (!meta) continue;
      out.push({
        supplierId: id,
        supplierName: supplier?.name ?? null,
        meta,
      });
    }
    return out;
  }, [supplierIds, suppliers, statsBySupplierId]);

  if (rows.length === 0) return null;

  const underLink = variant === "underLink";
  const multi = showSupplierNames || rows.length > 1;

  return (
    <div
      className={cn("space-y-1", className)}
      role="note"
      aria-label="Średni czas dostawy"
    >
      {rows.map((row) => (
        <p
          key={row.supplierId}
          className={cn(
            "flex flex-wrap items-center gap-x-1.5 gap-y-0.5 leading-snug",
            underLink
              ? "text-[11px] text-slate-500"
              : "text-xs text-slate-500"
          )}
          title={row.meta.tooltip}
        >
          <IconTruck
            size={underLink ? 12 : 13}
            className="shrink-0 text-slate-400"
            aria-hidden
          />
          {underLink ? (
            <>
              <span>{PROSBA_FORM_LEAD_TIME_UNDER_LINK_PREFIX}</span>
              <span className="font-medium tabular-nums text-slate-600">
                {row.meta.primaryText}
              </span>
              <span className="text-slate-400">do magazynu</span>
              {multi && row.supplierName ? (
                <>
                  <span className="text-slate-300" aria-hidden>
                    ·
                  </span>
                  <span className="truncate text-slate-500">{row.supplierName}</span>
                </>
              ) : null}
              {row.meta.sampleText ? (
                <>
                  <span className="text-slate-300" aria-hidden>
                    ·
                  </span>
                  <span className="text-slate-400">{row.meta.sampleText}</span>
                </>
              ) : null}
              {row.meta.lowConfidence ? (
                <span
                  className="text-[10px] font-medium uppercase tracking-wide text-amber-700/80"
                  title={row.meta.tooltip}
                >
                  szacunek
                </span>
              ) : null}
            </>
          ) : (
            <>
              {multi && row.supplierName ? (
                <>
                  <span className="font-medium text-slate-600">{row.supplierName}</span>
                  <span className="text-slate-300" aria-hidden>
                    ·
                  </span>
                </>
              ) : (
                <span className="text-slate-500">{PROSBA_FORM_LEAD_TIME_LABEL}</span>
              )}
              <span className="font-medium tabular-nums text-slate-700">
                {row.meta.primaryText}
              </span>
              {row.meta.sampleText ? (
                <>
                  <span className="text-slate-300" aria-hidden>
                    ·
                  </span>
                  <span>{row.meta.sampleText}</span>
                </>
              ) : null}
              {row.meta.lowConfidence ? (
                <span
                  className="text-[10px] font-medium uppercase tracking-wide text-amber-700/90"
                  title={row.meta.tooltip}
                >
                  szacunek
                </span>
              ) : null}
            </>
          )}
        </p>
      ))}
    </div>
  );
}
