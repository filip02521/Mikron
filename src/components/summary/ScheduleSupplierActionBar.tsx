"use client";

import { actionMarkOrdered, actionShiftOrder } from "@/app/actions/admin";
import { Button } from "@/components/ui/Button";
import { ShiftMenu } from "@/components/summary/ShiftMenu";
import { SupplierQuickActionsMenu } from "@/components/procurement/SupplierQuickActionsMenu";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";
import type { SupplierLocation } from "@/types/database";
import { cn } from "@/lib/cn";
import { panelSegmentPrimaryClass } from "@/lib/ui/ontime-theme";
import {
  buttonGroupItemClass,
  panelActionBarShellClass,
} from "@/lib/ui/surfaces";
import {
  urgentFooterPrimaryClass,
  urgentFooterShellClass,
  urgentFooterShiftSegmentClass,
  type UrgentCardTone,
} from "@/components/summary/urgent-card-styles";
import {
  DAILY_PANEL_MARK_ORDERED_LABEL,
  DAILY_PANEL_MARK_ORDERED_PENDING,
  DAILY_PANEL_MARK_ORDERED_PENDING_OVERLAY,
  dailyPanelMarkOrderedToastTitle,
} from "@/lib/orders/daily-panel-mark-ordered-copy";

/** Zamówione + Przesuń + menu Więcej — jeden segment wizualnie, osobne cele kliknięcia. */
export function ScheduleSupplierActionBar({
  supplierId,
  supplierName,
  location,
  pending,
  run,
  onOpenSupplier,
  onVacation,
  onEdit,
  className,
  compact,
  /** Footer karty Dziś — pełna szerokość jak prośby (bez sm:w-auto). */
  layout = "inline",
  /** Ton footera (zaległe amber / na dziś indigo). */
  tone = "today",
}: {
  supplierId: string;
  supplierName: string;
  location: SupplierLocation;
  pending: boolean;
  run: DailyPanelRunFn;
  onOpenSupplier?: () => void;
  onVacation: () => void;
  onEdit: () => void;
  className?: string;
  /** Układ pionowy — wąskie kolumny planu tygodnia */
  compact?: boolean;
  layout?: "inline" | "footer";
  tone?: UrgentCardTone;
}) {
  const scope = { scope: supplierId };
  const markOrdered = () =>
    run(
      () => actionMarkOrdered(supplierId),
      dailyPanelMarkOrderedToastTitle(supplierName),
      DAILY_PANEL_MARK_ORDERED_PENDING_OVERLAY,
      scope
    );

  const shiftHandlers = {
    onShiftWeeks: (w: number) =>
      run(
        () => actionShiftOrder(supplierId, w, null),
        `Przesunięto o ${w} ${w === 1 ? "tydzień" : "tygodnie"}`,
        `Przesuwanie o ${w} ${w === 1 ? "tydzień" : "tygodnie"}…`,
        scope
      ),
    onShiftDate: (iso: string) =>
      run(
        () => actionShiftOrder(supplierId, null, iso),
        "Ustawiono datę przesunięcia",
        "Zapisywanie nowej daty…",
        scope
      ),
  };

  if (compact) {
    return (
      <div
        role="group"
        aria-label={`Akcje harmonogramu — ${supplierName}`}
        aria-busy={pending}
        className={cn("flex w-full flex-col gap-1", pending && "opacity-60", className)}
      >
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={pending}
          className="h-9 w-full rounded-md text-xs font-semibold sm:h-7"
          onClick={markOrdered}
        >
          {pending ? DAILY_PANEL_MARK_ORDERED_PENDING : DAILY_PANEL_MARK_ORDERED_LABEL}
        </Button>
        <div className="flex gap-1">
          <ShiftMenu
            grouped
            compact
            disabled={pending}
            className="min-w-0 flex-1"
            {...shiftHandlers}
          />
          <SupplierQuickActionsMenu
            grouped
            compact
            includeOrderActions={false}
            supplierId={supplierId}
            supplierName={supplierName}
            location={location}
            pending={pending}
            run={run}
            runScope={supplierId}
            onOpenDetails={onOpenSupplier}
            onVacation={onVacation}
            onEdit={onEdit}
          />
        </div>
      </div>
    );
  }

  const isFooter = layout === "footer";

  return (
    <div
      role="group"
      aria-label={`Akcje harmonogramu — ${supplierName}`}
      aria-busy={pending}
      className={cn(
        isFooter ? urgentFooterShellClass(tone) : panelActionBarShellClass,
        pending && "opacity-60",
        className
      )}
    >
      <button
        type="button"
        disabled={pending}
        className={
          isFooter
            ? urgentFooterPrimaryClass(tone)
            : cn(
                buttonGroupItemClass,
                panelSegmentPrimaryClass,
                "focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50"
              )
        }
        onClick={markOrdered}
      >
        {pending ? DAILY_PANEL_MARK_ORDERED_PENDING : DAILY_PANEL_MARK_ORDERED_LABEL}
      </button>
      <ShiftMenu
        grouped
        disabled={pending}
        fill={isFooter}
        segmentClassName={isFooter ? urgentFooterShiftSegmentClass : undefined}
        {...shiftHandlers}
      />
      <SupplierQuickActionsMenu
        grouped
        includeOrderActions={false}
        supplierId={supplierId}
        supplierName={supplierName}
        location={location}
        pending={pending}
        run={run}
        runScope={supplierId}
        onOpenDetails={onOpenSupplier}
        onVacation={onVacation}
        onEdit={onEdit}
      />
    </div>
  );
}
