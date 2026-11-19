"use client";

import type { SummaryWorkspaceData } from "@/lib/orders/summary-workspace";
import type { DeliveryStats, StatsMode } from "@/types/database";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { DailyPanelEmptyGuide } from "@/components/summary/DailyPanelEmptyGuide";
import { SalesCancelledDailyPanel } from "@/components/summary/SalesCancelledDailyPanel";
import { ForSomeoneRequests } from "@/components/summary/ForSomeoneRequests";
import { DailySectionIcon } from "@/components/icons/StrokeIcons";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";
import type { OrderFormSupplierOption } from "@/lib/orders/order-form-suppliers";
import { useProcurementLanePrefs } from "@/components/summary/useProcurementLanePrefs";

export function DailyTodayView({
  workspace,
  verificationCount,
  hasTodayWork,
  hasForSomeone,
  hasStockOut,
  isScopePending,
  statsBySupplierId,
  supplierStatsMode,
  suppliers,
  salesPeople,
  run,
  onOpenSupplier,
  onOpenWeek,
  highlightFresh = false,
  notify,
  etaUseP50 = false,
  etaQuantilesBySupplierId = {},
  automat,
  supplierList,
}: {
  workspace: SummaryWorkspaceData;
  verificationCount: number;
  /** Lista dostawców ma wiersze albo są prośby / sygnały braku. */
  hasTodayWork: boolean;
  hasForSomeone: boolean;
  hasStockOut: boolean;
  isScopePending: (scope: string) => boolean;
  statsBySupplierId: Record<string, DeliveryStats>;
  supplierStatsMode: Record<string, StatsMode>;
  suppliers: OrderFormSupplierOption[];
  salesPeople: { id: string; name: string; email: string }[];
  run: DailyPanelRunFn;
  onOpenSupplier: (id: string) => void;
  onOpenWeek: () => void;
  highlightFresh?: boolean;
  notify?: (text: string, tone?: "success" | "error") => void;
  etaUseP50?: boolean;
  etaQuantilesBySupplierId?: Record<
    string,
    import("@/lib/orders/delivery-eta-quantiles-load").DeliveryEtaSupplierQuantiles
  >;
  /** Linia stanu automatu ZD (tylko gdy jest problem; role z Kreatorem ZD). */
  automat?: React.ReactNode;
  /** Lista „Dostawcy na dziś” — jeden wiersz na dostawcę. */
  supplierList?: React.ReactNode;
}) {
  const hasCancelled = workspace.salesCancelledNotices.length > 0;
  const showEmpty = !hasTodayWork && verificationCount === 0 && !hasCancelled;
  const lanePrefs = useProcurementLanePrefs(
    workspace.procurementFlagDefinitions,
    workspace.procurementLaneOrder
  );
  const requestProps = {
    isScopePending,
    run,
    onOpenSupplier,
    statsBySupplierId,
    supplierStatsMode,
    suppliers,
    salesPeople,
    supplierMeta: workspace.supplierMeta,
    todayDateKey: workspace.todayDateKey,
    weekDays: workspace.thisWeekDays,
    highlightFresh,
    suppliersOnVacationNow: workspace.suppliersOnVacationNow,
    procurementFlagDefinitions: workspace.procurementFlagDefinitions,
    procurementLaneOrder: workspace.procurementLaneOrder,
    lanePrefs,
    notify,
    etaUseP50,
    etaQuantilesBySupplierId,
  };

  return (
    <div id="panel-view-dzis" role="tabpanel" aria-labelledby="panel-tab-dzis" className="space-y-6">
      {automat}
      {!showEmpty ? (
        <div className="space-y-6">
          {hasCancelled ? (
            <SalesCancelledDailyPanel notices={workspace.salesCancelledNotices} isScopePending={isScopePending} run={run} />
          ) : null}
          {supplierList}
          {hasStockOut ? (
            <ForSomeoneRequests variant="stockOut" groups={workspace.stockOutLeft} sectionId="kolejka-brak-na-stanie" {...requestProps} />
          ) : null}
          {hasForSomeone ? <ForSomeoneRequests groups={workspace.forSomeoneLeft} {...requestProps} /> : null}
        </div>
      ) : (
        <>
          <EmptyState
            brandAccent
            title="Nic pilnego na dziś"
            description="Brak dostawców do zamówienia i próśb na dziś. Sprawdź zakładkę Tydzień lub terminy w kalendarzu."
            icon={<DailySectionIcon kind="dzis" size={28} />}
            action={
              <Button variant="secondary" size="sm" onClick={onOpenWeek}>
                Plan tygodnia
              </Button>
            }
          />
          <DailyPanelEmptyGuide onOpenWeek={onOpenWeek} />
        </>
      )}
    </div>
  );
}
