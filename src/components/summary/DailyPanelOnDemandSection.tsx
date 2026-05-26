"use client";

import type { OnDemandSupplierRow } from "@/lib/orders/summary-workspace";
import { actionMarkOrdered } from "@/app/actions/admin";
import { SupplierContactActions } from "@/components/procurement/SupplierContactActions";
import { Button } from "@/components/ui/Button";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { IconTruck } from "@/components/icons/StrokeIcons";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";
import { cn } from "@/lib/cn";
import { panelNameLinkClass, panelTextLinkClass } from "@/lib/ui/ontime-theme";

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
    <section className="rounded-xl border border-violet-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-violet-100/80 px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-start gap-2.5">
          <SectionHeadingIcon tileClassName="bg-violet-100 text-violet-800">
            <IconTruck size={16} />
          </SectionHeadingIcon>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              W razie potrzeby
              <span className="ml-2 font-normal tabular-nums text-slate-500">
                ({suppliers.length}{" "}
                {suppliers.length === 1 ? "dostawca" : "dostawców"})
              </span>
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              Bez stałego terminu w harmonogramie — zamów ręcznie, gdy towar jest potrzebny.
            </p>
          </div>
        </div>
        {onOpenFullList ? (
          <Button variant="outline" size="sm" className="shrink-0" onClick={onOpenFullList}>
            Pełna lista
          </Button>
        ) : null}
      </header>
      <ul className="divide-y divide-violet-50">
        {preview.map((row) => {
          const rowPending = isScopePending(row.supplierId);
          return (
            <li
              key={row.supplierId}
              className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 sm:px-5"
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
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                <SupplierContactActions notes={row.notes} mails={row.mails} className="mt-1" />
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
            </li>
          );
        })}
      </ul>
      {rest > 0 && onOpenFullList ? (
        <div className="border-t border-violet-100/80 px-4 py-2.5 sm:px-5">
          <button
            type="button"
            className={panelTextLinkClass}
            onClick={onOpenFullList}
          >
            + {rest} {rest === 1 ? "dostawca" : "dostawców"} — pokaż wszystkich
          </button>
        </div>
      ) : null}
    </section>
  );
}
