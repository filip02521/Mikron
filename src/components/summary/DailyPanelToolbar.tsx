"use client";

import type { DailyInboxSummary } from "@/lib/orders/procurement-daily-ui";
import type { DailyPanelView } from "@/lib/orders/daily-panel-view";
import { panelChromeInsetClass, panelTypography } from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";
import { polishPluralWord } from "@/lib/email/polish-plural";

export function DailyPanelToolbar({
  view,
  summary,
  exceptionsCount = 0,
  onOpenOnDemand,
}: {
  view: DailyPanelView;
  summary: DailyInboxSummary;
  exceptionsCount?: number;
  onOpenOnDemand?: () => void;
}) {
  if (view === "wyjatki") {
    return (
      <div className={cn("border-b border-slate-100 py-2.5 sm:py-3", panelChromeInsetClass)}>
        <p className={panelTypography.sectionTitle}>Wyjątki</p>
        <p className={cn("mt-0.5", panelTypography.sectionDesc)}>
          {exceptionsCount > 0
            ? `${exceptionsCount} ${polishPluralWord(
                exceptionsCount,
                "pozycja",
                "pozycje",
                "pozycji"
              )} poza główną kolejką - informacja, na żądanie, braki w harmonogramie.`
            : "Brak pozycji poza główną kolejką."}
          {summary.onDemandCount > 0 && onOpenOnDemand ? (
            <>
              {" "}
              <button
                type="button"
                className="font-medium text-slate-600 transition-colors hover:text-slate-800"
                onClick={onOpenOnDemand}
              >
                Na żądanie ({summary.onDemandCount})
              </button>
            </>
          ) : null}
        </p>
      </div>
    );
  }

  return null;
}
