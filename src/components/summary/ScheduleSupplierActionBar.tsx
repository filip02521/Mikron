"use client";

import { actionMarkOrdered, actionShiftOrder } from "@/app/actions/admin";
import { Button } from "@/components/ui/Button";
import { ShiftMenu } from "@/components/summary/ShiftMenu";
import { SupplierQuickActionsMenu } from "@/components/procurement/SupplierQuickActionsMenu";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";
import type { SupplierLocation } from "@/types/database";
import { cn } from "@/lib/cn";

const shellClass =
  "inline-flex max-w-full items-stretch rounded-xl border border-slate-200 bg-white shadow-sm";

const segmentClass =
  "min-h-9 shrink-0 !rounded-none border-0 shadow-none focus-visible:z-10";

/** Zamówione + Przesuń + ⋮ — jeden segment wizualnie, osobne cele kliknięcia. */
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
}: {
  supplierId: string;
  supplierName: string;
  location: SupplierLocation;
  pending: boolean;
  run: DailyPanelRunFn;
  onOpenSupplier: () => void;
  onVacation: () => void;
  onEdit: () => void;
  className?: string;
  /** Układ pionowy — wąskie kolumny planu tygodnia */
  compact?: boolean;
}) {
  const scope = { scope: supplierId };
  const markOrdered = () =>
    run(
      () => actionMarkOrdered(supplierId),
      "Oznaczono jako zamówione",
      "Oznaczanie jako zamówione…",
      scope
    );

  if (compact) {
    return (
      <div
        role="group"
        aria-label={`Akcje harmonogramu — ${supplierName}`}
        aria-busy={pending}
        className={cn("flex w-full flex-col gap-1.5", pending && "opacity-60", className)}
      >
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={pending}
          className="h-8 w-full rounded-lg text-xs font-semibold"
          onClick={markOrdered}
        >
          Zamówione
        </Button>
        <div className="flex gap-1">
          <ShiftMenu
            grouped
            compact
            disabled={pending}
            className="min-w-0 flex-1"
            onShiftWeeks={(w) =>
              run(
                () => actionShiftOrder(supplierId, w, null),
                `Przesunięto o ${w} ${w === 1 ? "tydzień" : "tygodnie"}`,
                `Przesuwanie o ${w} ${w === 1 ? "tydzień" : "tygodnie"}…`,
                scope
              )
            }
            onShiftDate={(iso) =>
              run(
                () => actionShiftOrder(supplierId, null, iso),
                "Ustawiono datę przesunięcia",
                "Zapisywanie nowej daty…",
                scope
              )
            }
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

  return (
    <div
      role="group"
      aria-label={`Akcje harmonogramu — ${supplierName}`}
      aria-busy={pending}
      className={cn(shellClass, pending && "opacity-60", className)}
    >
      <Button
        type="button"
        variant="primary"
        size="sm"
        disabled={pending}
        className={cn(segmentClass, "rounded-l-xl px-3.5 font-semibold")}
        onClick={markOrdered}
      >
        Zamówione
      </Button>
      <ShiftMenu
        grouped
        disabled={pending}
        onShiftWeeks={(w) =>
          run(
            () => actionShiftOrder(supplierId, w, null),
            `Przesunięto o ${w} ${w === 1 ? "tydzień" : "tygodnie"}`,
            `Przesuwanie o ${w} ${w === 1 ? "tydzień" : "tygodnie"}…`,
            scope
          )
        }
        onShiftDate={(iso) =>
          run(
            () => actionShiftOrder(supplierId, null, iso),
            "Ustawiono datę przesunięcia",
            "Zapisywanie nowej daty…",
            scope
          )
        }
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
