"use client";

import type { SummaryWorkspaceData } from "@/lib/orders/summary-workspace";
import { countDailyPanelExceptions } from "@/lib/orders/procurement-daily-ui";
import { DailyPanelHiddenSuppliers } from "@/components/summary/DailyPanelHiddenSuppliers";
import { DailyPanelInformacjaSection } from "@/components/summary/DailyPanelInformacjaSection";
import { DailyPanelOnDemandSection } from "@/components/summary/DailyPanelOnDemandSection";
import { SalesCancelledDailyCompact } from "@/components/summary/SalesCancelledDailyCompact";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { DailySectionIcon } from "@/components/icons/StrokeIcons";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";

export function DailyPanelExceptionsView({
  workspace,
  isScopePending,
  run,
  onOpenSupplier,
  onOpenOnDemand,
  onGoToday,
}: {
  workspace: SummaryWorkspaceData;
  isScopePending: (scope: string) => boolean;
  run: DailyPanelRunFn;
  onOpenSupplier: (id: string) => void;
  onOpenOnDemand?: () => void;
  onGoToday: () => void;
}) {
  const exceptionCount = countDailyPanelExceptions(workspace);
  const hasHidden = workspace.panelHidden.suppliers.length > 0;
  const hasInformacja = workspace.informacjaLeft.length > 0;
  const hasOnDemand = workspace.onDemandSuppliers.length > 0;
  const hasCancelled = workspace.salesCancelledNotices.length > 0;

  if (exceptionCount === 0) {
    return (
      <EmptyState
        title="Brak wyjątków"
        description="Wszystko jest w harmonogramie lub kolejce Dziś. Gdy pojawi się coś poza planem — zobaczysz to tutaj."
        icon={<DailySectionIcon kind="hidden" size={28} />}
        action={
          <Button variant="secondary" size="sm" onClick={onGoToday}>
            Wróć do Dziś
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {hasCancelled ? (
        <SalesCancelledDailyCompact
          notices={workspace.salesCancelledNotices}
          isScopePending={isScopePending}
          run={run}
        />
      ) : null}

      {hasInformacja ? (
        <DailyPanelInformacjaSection groups={workspace.informacjaLeft} />
      ) : null}

      {hasOnDemand ? (
        <DailyPanelOnDemandSection
          suppliers={workspace.onDemandSuppliers}
          isScopePending={isScopePending}
          onOpenSupplier={onOpenSupplier}
          onOpenFullList={onOpenOnDemand}
          run={run}
        />
      ) : null}

      {hasHidden ? (
        <DailyPanelHiddenSuppliers
          report={workspace.panelHidden}
          onOpenSupplier={onOpenSupplier}
        />
      ) : null}
    </div>
  );
}
