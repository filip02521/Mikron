"use client";

import { useState } from "react";
import type { SummaryWorkspaceData } from "@/lib/orders/summary-workspace";
import { WeekPlanner } from "@/components/summary/WeekPlanner";
import { ProsbaFormSection } from "@/components/orders/ProsbaFormSection";
import {
  panelDashedActionClass,
  panelSectionInsetClass,
  panelTextLinkClass,
} from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";

export function DailyWeekView({
  workspace,
  run,
  isScopePending,
  isPlanPending,
  onOpenSupplier,
  onVacation,
  onEdit,
  onOpenOnDemand,
}: {
  workspace: SummaryWorkspaceData;
  run: DailyPanelRunFn;
  isScopePending: (scope: string) => boolean;
  isPlanPending: boolean;
  onOpenSupplier: (id: string) => void;
  onVacation: (id: string) => void;
  onEdit: (id: string) => void;
  onOpenOnDemand: () => void;
}) {
  const [showNextWeek, setShowNextWeek] = useState(false);
  const thisWeekTotal = workspace.thisWeekDays.reduce((n, d) => n + d.items.length, 0);
  const thisWeekEmpty = thisWeekTotal === 0;
  const onDemandCount = workspace.onDemandSuppliers.length;

  return (
    <div
      id="panel-view-tydzien"
      role="tabpanel"
      aria-labelledby="panel-tab-tydzien"
      className={cn("space-y-3", panelSectionInsetClass)}
    >
        {onDemandCount > 0 && !thisWeekEmpty ? (
          <ProsbaFormSection
            title="Dostawcy na żądanie"
            hint="Bez stałego terminu w harmonogramie — zamów, gdy coś jest potrzebne."
          >
            <button
              type="button"
              className={cn("text-sm", panelTextLinkClass)}
              onClick={onOpenOnDemand}
            >
              Pokaż listę ({onDemandCount}{" "}
              {onDemandCount === 1 ? "dostawca" : "dostawców"})
            </button>
          </ProsbaFormSection>
        ) : null}

        <WeekPlanner
          title="Ten tydzień"
          description="Poniedziałek–piątek · zamówione z wyprzedzeniem lub szczegóły dostawcy"
          days={workspace.thisWeekDays}
          density="compact"
          onOpenSupplier={onOpenSupplier}
          onVacation={onVacation}
          onEdit={onEdit}
          run={run}
          isScopePending={isScopePending}
          isPlanPending={isPlanPending}
          emptyContext={
            thisWeekEmpty
              ? { onDemandCount, onOpenOnDemand: onOpenOnDemand }
              : undefined
          }
        />

        {showNextWeek ? (
          <>
            <WeekPlanner
              title="Następny tydzień"
              description="Ten sam układ co bieżący tydzień"
              days={workspace.nextWeekDays}
              density="compact"
              onOpenSupplier={onOpenSupplier}
              onVacation={onVacation}
              onEdit={onEdit}
              run={run}
              isScopePending={isScopePending}
              isPlanPending={isPlanPending}
            />
            <button
              type="button"
              onClick={() => setShowNextWeek(false)}
              className={cn("text-sm", panelTextLinkClass)}
            >
              Ukryj następny tydzień
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowNextWeek(true)}
            className={cn(panelDashedActionClass, "min-h-11 w-full sm:min-h-10 sm:w-auto")}
          >
            Pokaż następny tydzień
          </button>
        )}
    </div>
  );
}
