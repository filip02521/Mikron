"use client";

import Link from "next/link";
import type { SummaryInformacjaEnriched } from "@/lib/orders/summary-workspace";
import {
  enrichInformacjaGroup,
  sortInformacjaGroups,
} from "@/lib/orders/procurement-daily-ui";
import { Badge } from "@/components/ui/Badge";
import { InformacjaFlowLegend } from "@/components/orders/InformacjaFlowLegend";
import {
  DailyPanelSubsectionBar,
  dailyPanelQueueShellClass,
} from "@/components/summary/DailyPanelSubsectionBar";

export function DailyPanelInformacjaSection({
  groups,
}: {
  groups: SummaryInformacjaEnriched[];
}) {
  const sorted = sortInformacjaGroups(groups);
  if (!sorted.length) return null;

  return (
    <section className={dailyPanelQueueShellClass()}>
      <DailyPanelSubsectionBar
        title="Prośby tylko o dostępność"
        tone="default"
        count={sorted.length}
        countUnit={{ one: "grupa", few: "grupy", many: "grup" }}
        compact
      />
      <div className="border-b border-slate-100 px-3 py-1.5 sm:px-4">
        <InformacjaFlowLegend compact />
      </div>
      <ul className="divide-y divide-slate-100">
        {sorted.map((g) => {
          const ui = enrichInformacjaGroup(g);
          return (
            <li key={`${g.supplierId}-${g.salesPersonId}`} className="px-3 py-2.5 sm:px-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{g.person}</p>
                  <p className="text-xs text-slate-600">{g.supplierName}</p>
                  {ui.statusDetail ?? ui.subline ? (
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {ui.statusDetail ?? ui.subline}
                    </p>
                  ) : null}
                  <ul className="mt-1.5 space-y-1">
                    {g.lines.map((line) => (
                      <li
                        key={line.id}
                        className="text-[11px] leading-snug text-slate-700"
                      >
                        {line.symbol && line.symbol !== "-" ? (
                          <span className="font-medium text-slate-900">{line.symbol}</span>
                        ) : null}
                        {line.symbol && line.symbol !== "-" ? " — " : null}
                        <span>{line.products}</span>
                        {line.quantity && line.quantity !== "-" ? (
                          <span className="text-slate-500"> · {line.quantity}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
                <Badge variant="default" className="shrink-0 text-[10px]">
                  Informacja
                </Badge>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-slate-100 px-3 py-2 sm:px-4">
        <Link
          href="/kolejka#kolejka-przyjecie"
          className="text-xs font-medium text-slate-600 transition-colors hover:text-slate-800"
        >
          Kolejka magazynu → Informacja
        </Link>
      </div>
    </section>
  );
}
