"use client";

import type { DailyInboxSummary } from "@/lib/orders/procurement-daily-ui";
import type { DailyDayProgress } from "@/lib/orders/daily-day-progress";
import type { DailyPanelView } from "@/lib/orders/daily-panel-view";

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
      <div className="border-b border-slate-100 px-4 py-3 sm:px-6">
        <p className="text-sm font-semibold text-slate-900">Plan tygodnia</p>
        <p className="mt-0.5 text-xs text-slate-500">
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
      <div className="border-b border-slate-100 px-4 py-3 sm:px-6">
        <p className="text-sm font-semibold text-slate-900">Wyjątki</p>
        <p className="mt-0.5 text-xs text-slate-500">
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
