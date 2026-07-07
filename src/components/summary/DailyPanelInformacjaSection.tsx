"use client";

import Link from "next/link";
import { FlowChevron, LinkChevron } from "@/components/ui/UiGlyphs";
import type { SummaryInformacjaEnriched } from "@/lib/orders/summary-workspace";
import { sortInformacjaGroups } from "@/lib/orders/procurement-daily-ui";
import { procurementProductCountLabel } from "@/lib/orders/procurement-supplier-groups";
import { Badge } from "@/components/ui/Badge";
import { InformacjaDirectQueueIntro } from "@/components/orders/InformacjaFlowLegend";
import { cn } from "@/lib/cn";
import {
  DailyPanelSubsectionBar,
  dailyPanelQueueShellClass,
} from "@/components/summary/DailyPanelSubsectionBar";
import {
  dailyPanelListBodyClass,
  dailyPanelListRowPaddingClass,
  dailyPanelCardRowClass,
} from "@/components/summary/daily-panel-list-styles";
import { panelTypography } from "@/lib/ui/ontime-theme";

export function DailyPanelInformacjaSection({
  groups,
}: {
  groups: SummaryInformacjaEnriched[];
}) {
  const sorted = sortInformacjaGroups(groups);
  if (!sorted.length) return null;

  return (
    <section className={dailyPanelQueueShellClass("informacja")}>
      <DailyPanelSubsectionBar
        title="Prośby tylko o dostępność"
        tone="informacja"
        count={sorted.length}
        countUnit={{ one: "grupa", few: "grupy", many: "grup" }}
        compact
      />
      <InformacjaDirectQueueIntro />
      <ul className={dailyPanelListBodyClass}>
        {sorted.map((g) => {
          return (
            <li
              key={`${g.supplierId}-${g.salesPersonId}`}
              className={cn(dailyPanelCardRowClass("sky"), dailyPanelListRowPaddingClass)}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className={cn(panelTypography.rowTitle, "break-words")}>{g.supplierName}</p>
                  <p className={panelTypography.rowMeta}>
                    {g.person}
                    {" · "}
                    {procurementProductCountLabel(g.lines.length)}
                  </p>
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
      <div className="border-t border-sky-100/80 px-2.5 py-2 sm:px-3">
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
