"use client";

import {
  formatTeethGroupLabel,
  groupTeethDetails,
  TEETH_KIND_LABELS,
  type TeethGroupedDetail,
  type TeethLineDetail,
} from "@/lib/teeth/teeth-catalog";
import { jawRequiredForKind } from "@/lib/teeth/teeth-mould-shape-groups";
import { cn } from "@/lib/cn";
import { panelTypography } from "@/lib/ui/ontime-theme";
import { plPozycja } from "@/lib/ui/polish-plurals";
import { teethPanelSpecInsetClass, teethPanelSpecInsetDenseClass } from "@/lib/teeth/teeth-panel-ui";

const JAW_LABELS = { upper: "Góra", lower: "Dół" } as const;

function jawLabel(jaw: TeethGroupedDetail["jaw"], kind: TeethGroupedDetail["kind"]): string {
  if (!kind || !jawRequiredForKind(kind)) return "—";
  if (jaw === "upper") return JAW_LABELS.upper;
  if (jaw === "lower") return JAW_LABELS.lower;
  return "—";
}

function kindLabel(kind: TeethGroupedDetail["kind"]): string {
  if (!kind) return "—";
  return TEETH_KIND_LABELS[kind];
}

/** Czytelna specyfikacja zębów w panelu zakupów (kolejka / batch = tabela, historia = linijki). */
export function TeethPanelSpecList({
  details,
  groups,
  className,
  totalLabel,
  compact,
  layout = "table",
}: {
  details?: TeethLineDetail[] | undefined;
  groups?: TeethGroupedDetail[];
  className?: string;
  totalLabel?: string;
  compact?: boolean;
  /** `lines` — zwarte linijki (historia); `table` — kolumny (kolejka, batch). */
  layout?: "table" | "lines";
}) {
  const items = groups ?? groupTeethDetails(details);
  if (items.length === 0) return null;

  const total = items.reduce((sum, g) => sum + Math.max(1, g.count), 0);
  const insetClass = layout === "lines" || compact ? teethPanelSpecInsetDenseClass : teethPanelSpecInsetClass;

  if (layout === "lines") {
    return (
      <ul
        className={cn(insetClass, "space-y-0.5", className)}
        role="list"
        aria-label="Specyfikacja zębów"
      >
        {items.map((g, index) => (
          <li
            key={`${g.color}-${g.mould}-${g.jaw}-${g.kind}-${index}`}
            className="text-[11px] font-medium leading-snug text-slate-800"
          >
            {formatTeethGroupLabel(g)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div
      className={cn(insetClass, className)}
      role="region"
      aria-label="Specyfikacja zębów"
    >
      {(totalLabel || (!compact && total > 0)) ? (
        <p className={cn(panelTypography.caption, "mb-1 text-slate-500")}>
          {totalLabel ?? `${total} ${plPozycja(total)}`}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[16rem] text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200/80 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <th className={compact ? "py-0.5 pr-2" : "py-1 pr-2"}>Kolor</th>
              <th className={compact ? "py-0.5 pr-2" : "py-1 pr-2"}>Fason</th>
              <th className={compact ? "py-0.5 pr-2" : "py-1 pr-2"}>Szczęka</th>
              <th className={compact ? "py-0.5 pr-2" : "py-1 pr-2"}>Typ</th>
              <th className={cn("text-right tabular-nums", compact ? "py-0.5" : "py-1")}>Szt.</th>
            </tr>
          </thead>
          <tbody>
            {items.map((g, index) => (
              <tr
                key={`${g.color}-${g.mould}-${g.jaw}-${g.kind}-${index}`}
                className="border-b border-slate-100/90 last:border-b-0"
              >
                <td className={cn("pr-2 font-semibold text-slate-900", compact ? "py-0.5" : "py-1.5")}>
                  {g.color || "—"}
                </td>
                <td className={cn("pr-2 font-medium text-slate-800", compact ? "py-0.5" : "py-1.5")}>
                  {g.mould?.trim() || "—"}
                </td>
                <td className={cn("pr-2 text-slate-700", compact ? "py-0.5" : "py-1.5")}>
                  {jawLabel(g.jaw, g.kind)}
                </td>
                <td className={cn("pr-2 text-slate-700", compact ? "py-0.5" : "py-1.5")}>
                  {kindLabel(g.kind)}
                </td>
                <td
                  className={cn(
                    "text-right font-semibold tabular-nums text-slate-800",
                    compact ? "py-0.5" : "py-1.5",
                  )}
                >
                  {Math.max(1, g.count)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
