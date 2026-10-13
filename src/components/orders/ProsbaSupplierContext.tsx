"use client";

import { useMemo, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { leadTimeDisplayFromQuantiles } from "@/lib/orders/delivery-eta-quantiles-shared";
import type { SupplierScheduleSnapshot } from "@/lib/orders/my-order-presenter";
import type { OrderFormSupplierOption } from "@/lib/orders/order-form-suppliers";
import {
  buildProsbaFormLeadTimeMeta,
  PROSBA_FORM_LEAD_TIME_TOOLTIP,
} from "@/lib/orders/prosba-form-lead-time";
import { prosbaPlannedOrderDisplay } from "@/lib/orders/prosba-planned-order-display";
import type { ProsbaVacationNoticeModel } from "@/lib/orders/prosba-supplier-vacation-copy";
import type { WeekDayPlan } from "@/lib/orders/summary-workspace";
import type { DeliveryStats } from "@/types/database";

export type ProsbaLineSupplierTimingProps = {
  supplierId: string;
  suppliers: OrderFormSupplierOption[];
  supplierScheduleById: Record<string, SupplierScheduleSnapshot>;
  plannedOrderWeekDays?: WeekDayPlan[];
  todayDateKey?: string;
  statsBySupplierId: Record<string, DeliveryStats>;
  etaUseP50?: boolean;
  etaQuantilesBySupplierId?: Record<
    string,
    import("@/lib/orders/delivery-eta-quantiles-load").DeliveryEtaSupplierQuantiles
  >;
  vacationNoticeModel?: ProsbaVacationNoticeModel | null;
  showLeadTime?: boolean;
};

/** Dane do jednej cichej linii faktów — bez osobnego bloku UI. */
export function useProsbaLineSupplierTiming({
  supplierId,
  suppliers,
  supplierScheduleById,
  plannedOrderWeekDays = [],
  todayDateKey,
  statsBySupplierId,
  etaUseP50 = false,
  etaQuantilesBySupplierId = {},
  vacationNoticeModel = null,
  showLeadTime = true,
}: ProsbaLineSupplierTimingProps) {
  const knownId = supplierId.trim();
  const supplier = knownId
    ? suppliers.find((s) => s.id === knownId) ?? null
    : null;
  const planned = knownId
    ? prosbaPlannedOrderDisplay({
        supplierId: knownId,
        scheduleById: supplierScheduleById,
        todayDateKey,
        weekDays: plannedOrderWeekDays,
      })
    : null;

  const leadMeta = useMemo(() => {
    if (!showLeadTime || !knownId || !supplier) return null;
    return buildProsbaFormLeadTimeMeta(
      statsBySupplierId[knownId],
      (supplier.stats_mode ?? "LACZNIE") as import("@/types/database").StatsMode,
      leadTimeDisplayFromQuantiles(etaQuantilesBySupplierId[knownId], etaUseP50)
    );
  }, [
    showLeadTime,
    knownId,
    supplier,
    statsBySupplierId,
    etaQuantilesBySupplierId,
    etaUseP50,
  ]);

  if (!knownId) return null;
  if (!supplier && !planned && !leadMeta && !vacationNoticeModel) return null;

  return {
    supplierName: supplier?.name?.trim() || null,
    planned,
    leadMeta,
    vacationNoticeModel: vacationNoticeModel ?? null,
  };
}

function MetaDot() {
  return (
    <span className="shrink-0 text-slate-300" aria-hidden>
      ·
    </span>
  );
}

function MetaChip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("shrink-0 whitespace-nowrap tabular-nums", className)}>
      {children}
    </span>
  );
}

/**
 * Meta dostawcy / termin / lead — zawija tylko między segmentami, nigdy w środku „pob. ~2 d”.
 */
export function ProsbaLineSupplierMeta({
  timing,
  omitSupplierName = false,
  className,
}: {
  timing: NonNullable<ReturnType<typeof useProsbaLineSupplierTiming>>;
  omitSupplierName?: boolean;
  className?: string;
}) {
  const { supplierName, planned, leadMeta, vacationNoticeModel } = timing;
  const overdue = planned?.badgeVariant === "warning";

  const leadChips =
    leadMeta?.primaryText
      .split(/\s·\s/)
      .map((part) => part.trim())
      .filter(Boolean) ?? [];

  const showName = Boolean(!omitSupplierName && supplierName);
  const hasFacts = showName || Boolean(planned) || leadChips.length > 0;

  if (!hasFacts && !vacationNoticeModel) return null;

  const tooltip =
    [
      supplierName,
      planned?.title ?? planned?.label,
      leadMeta ? PROSBA_FORM_LEAD_TIME_TOOLTIP : null,
    ]
      .filter(Boolean)
      .join(" · ") || undefined;

  return (
    <div className={cn("min-w-0 space-y-0.5", className)}>
      {hasFacts ? (
        <div
          className={cn(
            "flex flex-wrap items-baseline gap-x-1 gap-y-0.5 text-xs leading-snug text-slate-600",
            overdue && "text-amber-950"
          )}
          title={tooltip}
        >
          {showName ? (
            <MetaChip className="font-medium text-slate-800">{supplierName}</MetaChip>
          ) : null}
          {planned ? (
            <>
              {showName ? <MetaDot /> : null}
              <MetaChip
                className={cn(
                  overdue ? "font-medium text-amber-950" : "text-slate-700"
                )}
              >
                {planned.label}
              </MetaChip>
            </>
          ) : null}
          {leadChips.map((chip, i) => (
            <span key={`${chip}-${i}`} className="contents">
              {showName || planned || i > 0 ? <MetaDot /> : null}
              <MetaChip className="text-slate-600">
                {chip}
                {i === leadChips.length - 1 && leadMeta?.lowConfidence
                  ? " · szacunek"
                  : ""}
              </MetaChip>
            </span>
          ))}
        </div>
      ) : null}

      {vacationNoticeModel ? (
        <p
          role="status"
          className="text-xs leading-snug text-amber-950"
          title={vacationNoticeModel.rangeTitle}
        >
          {vacationNoticeModel.title}
        </p>
      ) : null}
    </div>
  );
}

/**
 * @deprecated Użyj mety wewnątrz ProsbaAvailabilityCard.
 */
export function ProsbaSupplierContext(
  props: ProsbaLineSupplierTimingProps & { className?: string }
) {
  const timing = useProsbaLineSupplierTiming(props);
  if (!timing) return null;

  return (
    <div className={props.className} aria-label="Dostawca pozycji">
      <ProsbaLineSupplierMeta timing={timing} />
    </div>
  );
}
