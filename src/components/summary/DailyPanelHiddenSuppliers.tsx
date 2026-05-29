"use client";

import Link from "next/link";
import {
  DAILY_PANEL_HIDDEN_REASON_META,
  groupHiddenSuppliersByReason,
  type DailyPanelHiddenReport,
} from "@/lib/orders/daily-panel-hidden";
import {
  DailySectionIcon,
  dailySectionIconTileClass,
  IconChevronDown,
} from "@/components/icons/StrokeIcons";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { cn } from "@/lib/cn";
import { panelNameLinkClass, panelTextLinkClass } from "@/lib/ui/ontime-theme";

export function DailyPanelHiddenSuppliers({
  report,
  onOpenSupplier,
  embedded = false,
}: {
  report: DailyPanelHiddenReport;
  onOpenSupplier: (id: string) => void;
  embedded?: boolean;
}) {
  const groups = groupHiddenSuppliersByReason(report.suppliers);
  const hasSuppliers = report.suppliers.length > 0;

  if (!hasSuppliers) return null;

  return (
    <details
      id="poza-harmonogramem"
      className={cn(
        "scroll-mt-20",
        embedded
          ? "border-b border-slate-100"
          : "rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
      )}
      open={hasSuppliers && report.suppliers.length <= 8}
    >
      <summary className="cursor-pointer list-none px-4 py-3.5 marker:content-none sm:px-6 [&::-webkit-details-marker]:hidden">
        <div className="flex items-start gap-2.5">
          <SectionHeadingIcon tileClassName={dailySectionIconTileClass("hidden")}>
            <DailySectionIcon kind="hidden" size={16} />
          </SectionHeadingIcon>
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
              Braki w danych harmonogramu — dostawcy „w razie potrzeby” są w sekcji wyżej.
            </p>
          </div>
          <IconChevronDown className="mt-1 shrink-0 text-slate-400" size={18} />
        </div>
      </summary>

      <div className="space-y-4 border-t border-slate-100 px-4 py-4 sm:px-6">
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
                        className={cn("text-sm", panelNameLinkClass)}
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
                    <Link
                      href={`/lokalizacje/${row.location}`}
                      className={cn("shrink-0 text-xs", panelTextLinkClass)}
                    >
                      Terminy
                    </Link>
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
