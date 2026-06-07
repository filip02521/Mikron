"use client";

import type { DailyInboxSummary } from "@/lib/orders/procurement-daily-ui";
import type { DailyDayProgress } from "@/lib/orders/daily-day-progress";
import type { DailyPanelView } from "@/lib/orders/daily-panel-view";
import { panelChromeInsetClass, panelTypography } from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";

export function DailyPanelToolbar({
  view,
  summary,
  exceptionsCount = 0,
  onOpenOnDemand,
}: {
  view: DailyPanelView;
  summary: DailyInboxSummary;
  dayProgress?: DailyDayProgress;
  urgentVacationCount?: number;
  exceptionsCount?: number;
  verificationCount?: number;
  hideVerificationMetric?: boolean;
  onOpenOnDemand?: () => void;
}) {
  if (view === "dzis") {
    return null;
  }

  if (view === "tydzien") {
    if (summary.weekPlanCount === 0) {
      return null;
    }

    return (
      <div className={cn("border-b border-slate-100 py-2.5 sm:py-3", panelChromeInsetClass)}>
        <p className={panelTypography.sectionTitle}>Plan tygodnia</p>
        <p className={cn("mt-0.5", panelTypography.sectionDesc)}>
          {summary.weekPlanCount}{" "}
          {summary.weekPlanCount === 1 ? "pozycja" : "pozycje"}
          {summary.onDemandCount > 0 ? ` · ${summary.onDemandCount} na żądanie` : ""}. Karty
          dostawców poniżej ·{" "}
          <a href="/lokalizacje/POLSKA" className="font-medium text-indigo-700 hover:underline">
            Terminy
          </a>
        </p>
      </div>
    );
  }

  if (view === "wyjatki") {
    return (
      <div className={cn("border-b border-slate-100 py-2.5 sm:py-3", panelChromeInsetClass)}>
        <p className={panelTypography.sectionTitle}>Wyjątki</p>
        <p className={cn("mt-0.5", panelTypography.sectionDesc)}>
          {exceptionsCount > 0
            ? `${exceptionsCount} ${
                exceptionsCount === 1 ? "pozycja poza" : "pozycji poza"
              } główną kolejką — informacja, na żądanie, braki w harmonogramie.`
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
