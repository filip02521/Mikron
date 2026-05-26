"use client";

import type { DailyInboxSummary } from "@/lib/orders/procurement-daily-ui";
import type { DailyDayProgress } from "@/lib/orders/daily-day-progress";
import type { DailyPanelView } from "@/lib/orders/daily-panel-view";
import { DailyDayProgressBar } from "@/components/summary/DailyDayProgressBar";
import { DailyPanelMetricsOverview } from "@/components/summary/DailyPanelMetricsOverview";
export function DailyPanelToolbar({
  view,
  summary,
  dayProgress,
  urgentVacationCount,
  exceptionsCount = 0,
  onOpenOnDemand,
}: {
  view: DailyPanelView;
  summary: DailyInboxSummary;
  dayProgress: DailyDayProgress;
  urgentVacationCount: number;
  exceptionsCount?: number;
  onOpenOnDemand?: () => void;
}) {
  const urgentTotal = summary.overdueCount + summary.todayCount;

  if (view === "tydzien") {
    return (
      <div className="border-b border-slate-100 px-4 py-4 sm:px-6">
        <p className="text-sm font-semibold text-slate-900">Plan tygodnia</p>
        <p className="mt-1 text-sm text-slate-500">
          {summary.weekPlanCount > 0
            ? `${summary.weekPlanCount} ${summary.weekPlanCount === 1 ? "pozycja" : "pozycje"} w bieżącym tygodniu`
            : "Brak zaplanowanych zamówień w tym tygodniu"}
          {summary.onDemandCount > 0
            ? ` · ${summary.onDemandCount} na żądanie`
            : ""}
          . Zamówione i przesunięcia — na kartach dostawców poniżej.
        </p>
      </div>
    );
  }

  if (view === "wyjatki") {
    return (
      <div className="border-b border-slate-100 px-4 py-4 sm:px-6">
        <p className="text-sm font-semibold text-slate-900">Wyjątki i ścieżki poboczne</p>
        <p className="mt-1 text-sm text-slate-500">
          {exceptionsCount > 0
            ? `${exceptionsCount} ${
                exceptionsCount === 1 ? "pozycja wymaga" : "pozycji wymaga"
              } uwagi poza kolejką Dziś — rezygnacje, informacja, na żądanie, braki w harmonogramie.`
            : "Brak pozycji poza główną kolejką."}
          {summary.onDemandCount > 0 && onOpenOnDemand ? (
            <>
              {" "}
              <button
                type="button"
                className="font-medium text-slate-600 transition-colors hover:text-slate-800"
                onClick={onOpenOnDemand}
              >
                Pełna lista na żądanie ({summary.onDemandCount})
              </button>
            </>
          ) : null}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0 border-b border-slate-100">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-6">
        <DailyDayProgressBar progress={dayProgress} className="border-slate-200/80 bg-slate-50/60" />
      </div>
      <DailyPanelMetricsOverview
        summary={summary}
        urgentTotal={urgentTotal}
        onOpenOnDemand={onOpenOnDemand}
        urgentVacationCount={urgentVacationCount}
      />
    </div>
  );
}
