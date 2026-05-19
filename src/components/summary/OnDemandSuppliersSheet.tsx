"use client";

import type { OnDemandSupplierRow } from "@/lib/orders/summary-workspace";
import { actionMarkOrdered } from "@/app/actions/admin";
import { SupplierContactActions } from "@/components/procurement/SupplierContactActions";
import { HoldToConfirmButton } from "@/components/ui/HoldToConfirmButton";
import { Button } from "@/components/ui/Button";
import { ButtonGroup } from "@/components/ui/ButtonGroup";
import { EmptyState } from "@/components/ui/EmptyState";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";

export function OnDemandSuppliersSheet({
  open,
  suppliers,
  pending,
  onClose,
  onOpenSupplier,
  run,
}: {
  open: boolean;
  suppliers: OnDemandSupplierRow[];
  pending: boolean;
  onClose: () => void;
  onOpenSupplier: (id: string) => void;
  run: DailyPanelRunFn;
}) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-pointer bg-slate-900/30"
        aria-label="Zamknij listę"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl"
        aria-labelledby="on-demand-sheet-title"
      >
        <header className="shrink-0 border-b border-slate-100 px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                id="on-demand-sheet-title"
                className="text-base font-semibold text-slate-900"
              >
                W razie potrzeby
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Dostawcy bez stałego terminu w harmonogramie — zamów, gdy coś jest
                potrzebne.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Zamknij
            </Button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
          {suppliers.length === 0 ? (
            <EmptyState
              title="Brak dostawców na żądanie"
              description="Oznacz dostawcę w karcie lub ustaw zapas „W razie potrzeby”."
            />
          ) : (
            <ul className="space-y-2">
              {suppliers.map((row) => (
                <li
                  key={row.supplierId}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        className="text-left text-sm font-semibold text-slate-900 hover:underline"
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
                    <ButtonGroup
                      className="shrink-0"
                      ariaLabel="Zamówione — przytrzymaj, aby potwierdzić"
                    >
                      <HoldToConfirmButton
                        variant="primary"
                        className="px-3 py-2 text-xs"
                        disabled={pending}
                        label="Zamówione"
                        onConfirm={() =>
                          run(
                            () => actionMarkOrdered(row.supplierId),
                            `Zamówiono: ${row.supplierName}`,
                            "Oznaczanie jako zamówione…"
                          )
                        }
                      />
                    </ButtonGroup>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
