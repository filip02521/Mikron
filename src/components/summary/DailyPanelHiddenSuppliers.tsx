"use client";

import Link from "next/link";
import {
  DAILY_PANEL_HIDDEN_REASON_META,
  groupHiddenSuppliersByReason,
  type DailyPanelHiddenReport,
} from "@/lib/orders/daily-panel-hidden";
import { IconChevronDown } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { panelNameLinkClass, panelTextLinkClass } from "@/lib/ui/ontime-theme";
import { dailyPanelQueueSectionScrollClass } from "@/lib/orders/daily-panel-section-anchors";
import { dailyPanelQueueShellClass } from "@/components/summary/DailyPanelSubsectionBar";
import {
  dailyPanelFlatListClass,
  dailyPanelListInsetClass,
  dailyPanelListRowPaddingClass,
} from "@/components/summary/daily-panel-list-styles";

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
        dailyPanelQueueSectionScrollClass,
        embedded ? "" : dailyPanelQueueShellClass()
      )}
      open={hasSuppliers && report.suppliers.length <= 8}
    >
      <summary className="cursor-pointer list-none border-b border-slate-100 bg-slate-50/50 px-3 py-3 marker:content-none sm:px-4 sm:py-2 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">
              Poza listą harmonogramu
              <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-600">
                {report.suppliers.length}
              </span>
            </p>
          </div>
          <IconChevronDown className="shrink-0 text-slate-400" size={16} />
        </div>
      </summary>

      <div className={cn(dailyPanelListInsetClass, "space-y-3")}>
        {groups.map(({ reason, items }) => {
          const meta = DAILY_PANEL_HIDDEN_REASON_META[reason];
          return (
            <div key={reason}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {meta.sectionTitle}
                <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-400">
                  ({items.length})
                </span>
              </p>
              <ul className={cn(dailyPanelFlatListClass(), "overflow-hidden rounded-md border border-slate-200/90 bg-white/90")}>
                {items.map((row) => (
                  <li
                    key={row.supplierId}
                    className={cn(
                      "flex flex-wrap items-start justify-between gap-2",
                      dailyPanelListRowPaddingClass
                    )}
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
                      <p className="mt-0.5 text-xs leading-snug text-slate-600">{row.detail}</p>
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
