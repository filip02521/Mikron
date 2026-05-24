"use client";

import Link from "next/link";
import {
  DAILY_PANEL_HIDDEN_REASON_META,
  groupHiddenSuppliersByReason,
  type DailyPanelHiddenReport,
} from "@/lib/orders/daily-panel-hidden";

export function DailyPanelHiddenSuppliers({
  report,
  onOpenSupplier,
  onOpenOnDemand,
}: {
  report: DailyPanelHiddenReport;
  onOpenSupplier: (id: string) => void;
  onOpenOnDemand?: () => void;
}) {
  const groups = groupHiddenSuppliersByReason(report.suppliers);
  const hasSuppliers = report.suppliers.length > 0;
  const hasInformacja = report.informacjaGroupCount > 0;

  if (!hasSuppliers && !hasInformacja) return null;

  return (
    <details
      id="poza-harmonogramem"
      className="scroll-mt-20 rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
      open={hasSuppliers && report.suppliers.length <= 8}
    >
      <summary className="cursor-pointer list-none px-4 py-3.5 marker:content-none sm:px-5 [&::-webkit-details-marker]:hidden">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">
              Poza listą harmonogramu
              {hasSuppliers ? (
                <span className="ml-2 font-normal tabular-nums text-slate-500">
                  ({report.suppliers.length}{" "}
                  {report.suppliers.length === 1 ? "dostawca" : "dostawców"})
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              Dostawcy, którzy nie pojawią się w harmonogramie, dopóki brakuje danych lub mają
              zamówienie na żądanie — oraz prośby obsługiwane gdzie indziej.
            </p>
          </div>
          <span className="shrink-0 text-xs font-medium text-indigo-600">Rozwiń</span>
        </div>
      </summary>

      <div className="space-y-4 border-t border-slate-100 px-4 py-4 sm:px-5">
        {hasInformacja ? (
          <div className="rounded-lg border border-sky-200/90 bg-sky-50/50 px-3.5 py-3">
            <p className="text-sm font-medium text-sky-950">
              Prośby tylko o dostępność (
              {report.informacjaGroupCount === 1
                ? "1 grupa"
                : `${report.informacjaGroupCount} grup`}
              {report.informacjaLineCount > 0
                ? ` · ${report.informacjaLineCount} prod.`
                : ""}
              )
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-sky-900/85">
              Nie składamy zamówienia u dostawcy — obsługa w{" "}
              <Link
                href="/kolejka#informacja"
                className="font-medium underline decoration-sky-300 underline-offset-2 hover:text-sky-950"
              >
                Magazyn i regał → Informacja
              </Link>
              .
            </p>
          </div>
        ) : null}

        {groups.map(({ reason, items }) => {
          const meta = DAILY_PANEL_HIDDEN_REASON_META[reason];
          return (
            <div key={reason}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {meta.sectionTitle}
                <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-400">
                  ({items.length})
                </span>
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                {meta.sectionHint}
              </p>
              <ul className="mt-2 space-y-1.5">
                {items.map((row) => (
                  <li
                    key={row.supplierId}
                    className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-200/80 bg-slate-50/60 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onOpenSupplier(row.supplierId)}
                        className="text-left text-sm font-medium text-slate-900 hover:underline"
                      >
                        {row.supplierName}
                      </button>
                      <p className="text-[11px] text-slate-500">
                        {row.locationLabel}
                        {row.nextDateLabel ? ` · termin ${row.nextDateLabel}` : ""}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                        {row.detail}
                      </p>
                    </div>
                    {reason === "on_demand" && onOpenOnDemand ? (
                      <button
                        type="button"
                        onClick={onOpenOnDemand}
                        className="shrink-0 text-xs font-medium text-violet-800 hover:underline"
                      >
                        Lista na żądanie
                      </button>
                    ) : (
                      <Link
                        href={`/lokalizacje/${row.location}`}
                        className="shrink-0 text-xs font-medium text-indigo-700 hover:underline"
                      >
                        Terminy
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </details>
  );
}
