"use client";

import type { OnDemandSupplierRow } from "@/lib/orders/summary-workspace";
import { actionMarkOrdered } from "@/app/actions/admin";
import { SupplierContactActions } from "@/components/procurement/SupplierContactActions";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";
import { cn } from "@/lib/cn";
import { panelNameLinkClass } from "@/lib/ui/ontime-theme";
import { PanelRowActionsInlineEnd } from "@/components/summary/PanelRowActionsInlineEnd";
import { panelRowClearFocusOnLeave, panelRowGroupClass } from "@/lib/ui/panel-row-actions-reveal";
import { SCROLL_LOCK_ALLOW_ATTR, useBodyScrollLock } from "@/lib/ui/page-scroll-lock";
import { sidePanelBackdropClass, sidePanelShellClass, sidePanelCloseButtonClass, sidePanelHeaderClass, sidePanelContentClass } from "@/lib/ui/surfaces";
import { IconX } from "@/components/icons/StrokeIcons";

export function OnDemandSuppliersSheet({
  open,
  suppliers,
  isScopePending,
  onClose,
  onOpenSupplier,
  run,
}: {
  open: boolean;
  suppliers: OnDemandSupplierRow[];
  isScopePending: (supplierId: string) => boolean;
  onClose: () => void;
  onOpenSupplier: (id: string) => void;
  run: DailyPanelRunFn;
}) {
  useBodyScrollLock(open);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className={cn(sidePanelBackdropClass, "panel-slide-backdrop-enter")}
        aria-label="Zamknij listę"
        onClick={onClose}
      />
      <aside
        className={cn(sidePanelShellClass, "max-w-md", "panel-slide-enter")}
        aria-labelledby="on-demand-sheet-title"
      >
        <header className={sidePanelHeaderClass}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                id="on-demand-sheet-title"
                className="text-lg font-semibold text-slate-900"
              >
                W razie potrzeby
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                Dostawcy bez stałego terminu w harmonogramie — zamów, gdy coś jest
                potrzebne.
              </p>
            </div>
            <button
              type="button"
              className={sidePanelCloseButtonClass}
              onClick={onClose}
              aria-label="Zamknij"
            >
              <IconX size={18} />
            </button>
          </div>
        </header>

        <div
          className={sidePanelContentClass}
          {...{ [SCROLL_LOCK_ALLOW_ATTR]: "" }}
        >
          {suppliers.length === 0 ? (
            <EmptyState
              title="Brak dostawców na żądanie"
              description="Oznacz dostawcę w karcie lub ustaw zapas „W razie potrzeby”."
            />
          ) : (
            <ul className="space-y-2">
              {suppliers.map((row) => {
                const rowPending = isScopePending(row.supplierId);
                return (
                  <li
                    key={row.supplierId}
                    className={panelRowGroupClass(
                      "rounded-md border border-slate-200 bg-slate-50/50 px-3 py-2.5"
                    )}
                    onMouseLeave={panelRowClearFocusOnLeave}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          className={cn("text-sm font-semibold", panelNameLinkClass)}
                          onClick={() => onOpenSupplier(row.supplierId)}
                        >
                          {row.supplierName}
                        </button>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {row.locationLabel}
                          {row.stockLabel !== "—" ? ` · ${row.stockLabel}` : ""}
                          {row.intervalLabel && row.intervalLabel !== "—"
                            ? ` · ${row.intervalLabel}`
                            : ""}
                        </p>
                        <SupplierContactActions
                          notes={row.notes}
                          mails={row.mails}
                          className="mt-2"
                        />
                      </div>
                      <PanelRowActionsInlineEnd forceVisible={rowPending}>
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={rowPending}
                          onClick={() =>
                            run(
                              () => actionMarkOrdered(row.supplierId),
                              `Zamówiono: ${row.supplierName}`,
                              "Oznaczanie jako zamówione…",
                              { scope: row.supplierId }
                            )
                          }
                        >
                          Zamówione
                        </Button>
                      </PanelRowActionsInlineEnd>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
