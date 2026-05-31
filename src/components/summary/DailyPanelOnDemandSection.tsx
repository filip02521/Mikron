"use client";

import type { OnDemandSupplierRow } from "@/lib/orders/summary-workspace";
import { actionMarkOrdered } from "@/app/actions/admin";
import { SupplierContactActions } from "@/components/procurement/SupplierContactActions";
import { Button } from "@/components/ui/Button";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";
import { cn } from "@/lib/cn";
import { panelNameLinkClass, panelTextLinkClass } from "@/lib/ui/ontime-theme";
import { PanelRowActionsInlineEnd } from "@/components/summary/PanelRowActionsInlineEnd";
import { panelRowClearFocusOnLeave, panelRowGroupClass } from "@/lib/ui/panel-row-actions-reveal";
import {
  DailyPanelSubsectionBar,
  dailyPanelQueueShellClass,
} from "@/components/summary/DailyPanelSubsectionBar";

export function DailyPanelOnDemandSection({
  suppliers,
  isScopePending,
  onOpenSupplier,
  onOpenFullList,
  run,
}: {
  suppliers: OnDemandSupplierRow[];
  isScopePending: (supplierId: string) => boolean;
  onOpenSupplier: (id: string) => void;
  onOpenFullList?: () => void;
  run: DailyPanelRunFn;
}) {
  if (!suppliers.length) return null;

  const preview = suppliers.slice(0, 6);
  const rest = suppliers.length - preview.length;

  return (
    <section className={dailyPanelQueueShellClass()}>
      <DailyPanelSubsectionBar
        title="W razie potrzeby"
        tone="default"
        count={suppliers.length}
        countUnit={{ one: "dostawca", few: "dostawców", many: "dostawców" }}
        compact
        action={
          onOpenFullList ? (
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onOpenFullList}>
              Pełna lista
            </Button>
          ) : null
        }
      />
      <ul className="divide-y divide-slate-100">
        {preview.map((row) => {
          const rowPending = isScopePending(row.supplierId);
          return (
            <li
              key={row.supplierId}
              className={panelRowGroupClass(
                "flex items-start justify-between gap-2 px-3 py-2 sm:px-4"
              )}
              onMouseLeave={panelRowClearFocusOnLeave}
            >
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  className={cn("text-sm font-semibold", panelNameLinkClass)}
                  onClick={() => onOpenSupplier(row.supplierId)}
                >
                  {row.supplierName}
                </button>
                <p className="text-[11px] text-slate-500">
                  {row.locationLabel}
                  {row.stockLabel ? ` · ${row.stockLabel}` : ""}
                </p>
              </div>
              <PanelRowActionsInlineEnd forceVisible={rowPending}>
                <div className="flex flex-wrap items-center justify-end gap-1">
                  <SupplierContactActions notes={row.notes} mails={row.mails} />
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={rowPending}
                    onClick={() =>
                      run(
                        () => actionMarkOrdered(row.supplierId),
                        "Oznaczono jako zamówione",
                        "Oznaczanie…",
                        { scope: row.supplierId }
                      )
                    }
                  >
                    Zamówione
                  </Button>
                </div>
              </PanelRowActionsInlineEnd>
            </li>
          );
        })}
      </ul>
      {rest > 0 && onOpenFullList ? (
        <div className="border-t border-slate-100 px-3 py-2 sm:px-4">
          <button type="button" className={cn("text-xs", panelTextLinkClass)} onClick={onOpenFullList}>
            + {rest} {rest === 1 ? "dostawca" : "dostawców"} — pokaż wszystkich
          </button>
        </div>
      ) : null}
    </section>
  );
}
