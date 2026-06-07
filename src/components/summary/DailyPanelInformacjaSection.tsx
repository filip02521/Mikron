"use client";

import Link from "next/link";
import { FlowChevron, LinkChevron } from "@/components/ui/UiGlyphs";
import type { SummaryInformacjaEnriched } from "@/lib/orders/summary-workspace";
import {
  enrichInformacjaGroup,
  sortInformacjaGroups,
} from "@/lib/orders/procurement-daily-ui";
import { Badge } from "@/components/ui/Badge";
import { InformacjaFlowLegend } from "@/components/orders/InformacjaFlowLegend";
import { cn } from "@/lib/cn";
import {
  DailyPanelSubsectionBar,
  dailyPanelQueueShellClass,
} from "@/components/summary/DailyPanelSubsectionBar";
import { panelTypography } from "@/lib/ui/ontime-theme";

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
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className={panelTypography.rowTitle}>{g.person}</p>
                  <p className={panelTypography.rowMeta}>{g.supplierName}</p>
                  {ui.statusDetail ?? ui.subline ? (
                    <p className={cn("mt-0.5", panelTypography.caption)}>
                      {ui.statusDetail ?? ui.subline}
                    </p>
                  ) : null}
                  <ul className="mt-1.5 space-y-1">
                    {g.lines.map((line) => (
                      <li
                        key={line.id}
                        className={cn("leading-snug text-slate-700", panelTypography.caption)}
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
                <Badge variant="default" className="shrink-0 self-start text-[10px] sm:self-auto">
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
          className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 transition-colors hover:text-sky-900"
        >
          <span>Kolejka magazynu</span>
          <FlowChevron size={12} className="text-sky-400" />
          <span>Informacja</span>
          <LinkChevron size={13} tone="sky" className="ml-0.5" />
        </Link>
      </div>
    </section>
  );
}
