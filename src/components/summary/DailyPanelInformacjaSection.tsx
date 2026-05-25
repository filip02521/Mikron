"use client";

import Link from "next/link";
import type { SummaryInformacjaEnriched } from "@/lib/orders/summary-workspace";
import {
  enrichInformacjaGroup,
  sortInformacjaGroups,
} from "@/lib/orders/procurement-daily-ui";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { DailySectionIcon, dailySectionIconTileClass } from "@/components/icons/StrokeIcons";
import { Badge } from "@/components/ui/Badge";
import { informacjaSurfaceClass } from "@/lib/ui/ontime-theme";

export function DailyPanelInformacjaSection({
  groups,
}: {
  groups: SummaryInformacjaEnriched[];
}) {
  const sorted = sortInformacjaGroups(groups);
  if (!sorted.length) return null;

  const lineCount = sorted.reduce((n, g) => n + g.lines.length, 0);

  return (
    <section className={informacjaSurfaceClass}>
      <header className="flex items-start gap-2.5 border-b border-sky-100/80 px-4 py-3.5 sm:px-5">
        <SectionHeadingIcon tileClassName={dailySectionIconTileClass("hidden")}>
          <DailySectionIcon kind="prosby" size={16} />
        </SectionHeadingIcon>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">
            Prośby tylko o dostępność
            <span className="ml-2 font-normal tabular-nums text-slate-500">
              ({sorted.length} {sorted.length === 1 ? "grupa" : "grup"}
              {lineCount > 0 ? ` · ${lineCount} prod.` : ""})
            </span>
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-sky-900/85">
            Bez zamówienia u dostawcy — obsługa w magazynie po przyjęciu towaru.
          </p>
        </div>
      </header>
      <ul className="divide-y divide-sky-50">
        {sorted.map((g) => {
          const ui = enrichInformacjaGroup(g);
          return (
            <li key={`${g.supplierId}-${g.salesPersonId}`} className="px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{g.person}</p>
                  <p className="text-xs text-slate-600">
                    {g.supplierName} · {g.lines.length}{" "}
                    {g.lines.length === 1 ? "produkt" : "produkty"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{ui.statusDetail ?? ui.subline}</p>
                </div>
                <Badge variant="info">Informacja</Badge>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-sky-100/80 px-4 py-3 sm:px-5">
        <Link
          href="/kolejka#informacja"
          className="text-sm font-medium text-sky-800 underline decoration-sky-300 underline-offset-2 hover:text-sky-950"
        >
          Otwórz kolejkę magazynu → Informacja
        </Link>
      </div>
    </section>
  );
}
