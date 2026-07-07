"use client";

import type { OnDemandSupplierRow } from "@/lib/orders/summary-workspace";
import { actionMarkOrdered } from "@/app/actions/admin";
import { SupplierContactActions } from "@/components/procurement/SupplierContactActions";
import { Button } from "@/components/ui/Button";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";
import { LinkChevron } from "@/components/ui/UiGlyphs";
import { cn } from "@/lib/cn";
import { panelNameLinkClass, panelTextLinkClass, panelTypography } from "@/lib/ui/ontime-theme";
import { PanelRowActionsInlineEnd } from "@/components/summary/PanelRowActionsInlineEnd";
import { panelRowClearFocusOnLeave, panelRowGroupClass } from "@/lib/ui/panel-row-actions-reveal";
import {
  panelQueueRowActionsClass,
  panelQueueRowLayoutClass,
} from "@/lib/ui/surfaces";
import {
  DailyPanelSubsectionBar,
  dailyPanelQueueShellClass,
} from "@/components/summary/DailyPanelSubsectionBar";
import {
  dailyPanelFlatListClass,
  dailyPanelListInsetClass,
  dailyPanelListRowPaddingClass,
} from "@/components/summary/daily-panel-list-styles";

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
            <Button variant="ghost" size="sm" className="h-10 min-h-10 px-2 text-xs sm:h-8 sm:min-h-8" onClick={onOpenFullList}>
              Pełna lista
            </Button>
          ) : null
        }
      />
      <div className={dailyPanelListInsetClass}>
        <ul className={dailyPanelFlatListClass()}>
          {preview.map((row) => {
            const rowPending = isScopePending(row.supplierId);
            return (
              <li
                key={row.supplierId}
                className={cn(panelRowGroupClass(dailyPanelListRowPaddingClass))}
                onMouseLeave={panelRowClearFocusOnLeave}
              >
              <div className={panelQueueRowLayoutClass}>
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    className={cn(panelTypography.rowTitle, panelNameLinkClass, "break-words")}
                    onClick={() => onOpenSupplier(row.supplierId)}
                  >
                    {row.supplierName}
                  </button>
                  <p className={panelTypography.caption}>
                    {row.locationLabel}
                    {row.stockLabel ? ` · ${row.stockLabel}` : ""}
                  </p>
                </div>
              <PanelRowActionsInlineEnd
                forceVisible={rowPending}
                className={panelQueueRowActionsClass}
                contentClassName="w-full sm:w-max"
              >
                <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-1">
                  <SupplierContactActions notes={row.notes} mails={row.mails} />
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={rowPending}
                    className="h-10 min-h-10 w-full sm:h-9 sm:min-h-9 sm:w-auto"
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
              </div>
            </li>
          );
        })}
        </ul>
      </div>
      {rest > 0 && onOpenFullList ? (
        <div className="border-t border-slate-100 px-3 py-2 sm:px-4">
          <button
            type="button"
            className={cn("inline-flex items-center gap-1 text-xs", panelTextLinkClass)}
            onClick={onOpenFullList}
          >
            + {rest} {rest === 1 ? "dostawca" : "dostawców"} — pokaż wszystkich
            <LinkChevron size={12} tone="brand" />
          </button>
        </div>
      ) : null}
    </section>
  );
}
