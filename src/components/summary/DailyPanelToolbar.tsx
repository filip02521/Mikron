"use client";

import type { DailyInboxSummary } from "@/lib/orders/procurement-daily-ui";
import type { DailyPanelView } from "@/lib/orders/daily-panel-view";
import { panelTypography } from "@/lib/ui/ontime-theme";
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
      // -mb-3: pod nagłówkiem sekcji mniej odstępu niż nad nim (rodzic ma space-y-6).
      <div className="-mb-3">
        <h2 className="text-lg font-semibold tracking-[-0.015em] text-slate-900">Wyjątki</h2>
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
                className="font-medium text-indigo-700 underline-offset-2 transition-colors hover:text-indigo-900 hover:underline"
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
