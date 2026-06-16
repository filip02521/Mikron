"use client";

import type { DailyInboxSummary } from "@/lib/orders/procurement-daily-ui";
import type { DailyDayProgress } from "@/lib/orders/daily-day-progress";
import type { DailyPanelView } from "@/lib/orders/daily-panel-view";
import { DailyPanelStatusBand } from "@/components/summary/DailyPanelStatusBand";
import { DailyPanelSyncControl } from "@/components/summary/DailyPanelSyncControl";
import { cn } from "@/lib/cn";
import { panelChromeInsetClass } from "@/lib/ui/ontime-theme";

/** Sticky stopka pod zakładkami — status Dziś (opcjonalnie) + sync na wszystkich widokach. */
export function DailyPanelStickyFooter({
  view,
  summary,
  dayProgress,
  dayProgressReady = true,
  verificationCount = 0,
  showVerification = true,
  urgentVacationCount = 0,
  onOpenOnDemand,
}: {
  view: DailyPanelView;
  summary: DailyInboxSummary;
  dayProgress: DailyDayProgress;
  dayProgressReady?: boolean;
  verificationCount?: number;
  showVerification?: boolean;
  urgentVacationCount?: number;
  onOpenOnDemand?: () => void;
}) {
  const showStatusBand = view === "dzis";

  return (
    <>
      {showStatusBand ? (
        <DailyPanelStatusBand
          view={view}
          summary={summary}
          dayProgress={dayProgress}
          dayProgressReady={dayProgressReady}
          verificationCount={verificationCount}
          showVerification={showVerification}
          urgentVacationCount={urgentVacationCount}
          onOpenOnDemand={onOpenOnDemand}
        />
      ) : null}
      <div className={cn("py-2.5 sm:py-3", panelChromeInsetClass, showStatusBand && "pt-0")}>
        <DailyPanelSyncControl embedded={showStatusBand} />
      </div>
    </>
  );
}
