"use client";

import type { SummaryWorkspaceData } from "@/lib/orders/summary-workspace";
import type { SummaryStandardItem } from "@/lib/orders/summary";
import type { DeliveryStats, StatsMode } from "@/types/database";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { DailyPanelEmptyGuide } from "@/components/summary/DailyPanelEmptyGuide";
import { DailyPanelVerificationBanner } from "@/components/summary/DailyPanelVerificationBanner";
import { SalesCancelledDailyPanel } from "@/components/summary/SalesCancelledDailyPanel";
import { ForSomeoneRequests } from "@/components/summary/ForSomeoneRequests";
import { UrgentOrdersSection } from "@/components/summary/UrgentOrdersSection";
import {
  DailySectionIcon,
} from "@/components/icons/StrokeIcons";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";
import { panelSectionInsetClass } from "@/lib/ui/ontime-theme";
import type { OrderFormSupplierOption } from "@/lib/orders/order-form-suppliers";

export function DailyTodayView({
  workspace,
  verificationCount,
  hasTodayWork,
  hasForSomeone,
  hasStockOut,
  urgentOverdue,
  urgentToday,
  standardUrgentAll,
  queueStepBySection,
  selected,
  selectedCount,
  isScopePending,
  isBulkPending,
  statsBySupplierId,
  supplierStatsMode,
  suppliers,
  salesPeople,
  run,
  onOpenSupplier,
  onVacation,
  onEdit,
  onToggle,
  onSelectAllInScope,
  onBulkOrdered,
  onOpenVerification,
  onOpenWeek,
  highlightFresh = false,
}: {
  workspace: SummaryWorkspaceData;
  verificationCount: number;
  hasTodayWork: boolean;
  hasForSomeone: boolean;
  hasStockOut: boolean;
  urgentOverdue: SummaryStandardItem[];
  urgentToday: SummaryStandardItem[];
  standardUrgentAll: SummaryStandardItem[];
  queueStepBySection: {
    overdue?: number;
    stockOut?: number;
    prosby?: number;
    today?: number;
  };
  selected: Record<string, boolean>;
  selectedCount: number;
  isScopePending: (scope: string) => boolean;
  isBulkPending: boolean;
  statsBySupplierId: Record<string, DeliveryStats>;
  supplierStatsMode: Record<string, StatsMode>;
  suppliers: OrderFormSupplierOption[];
  salesPeople: { id: string; name: string; email: string }[];
  run: DailyPanelRunFn;
  onOpenSupplier: (id: string) => void;
  onVacation: (id: string) => void;
  onEdit: (id: string) => void;
  onToggle: (supplierId: string) => void;
  onSelectAllInScope: (checked: boolean, supplierIds: string[]) => void;
  onBulkOrdered: () => void;
  onOpenVerification: () => void;
  onOpenWeek: () => void;
  highlightFresh?: boolean;
}) {
  const hasCancelled = workspace.salesCancelledNotices.length > 0;
  const showEmpty = !hasTodayWork && verificationCount === 0 && !hasCancelled;

  return (
    <div
      id="panel-view-dzis"
      role="tabpanel"
      aria-labelledby="panel-tab-dzis"
      className={panelSectionInsetClass}
    >
        {!showEmpty ? (
          <div className="space-y-3">
            {hasCancelled ? (
              <SalesCancelledDailyPanel
                notices={workspace.salesCancelledNotices}
                isScopePending={isScopePending}
                run={run}
              />
            ) : null}
            {verificationCount > 0 ? (
              <DailyPanelVerificationBanner
                count={verificationCount}
                onOpenModal={onOpenVerification}
              />
            ) : null}
            {hasTodayWork ? (
              <>
                {urgentOverdue.length > 0 ? (
                  <UrgentOrdersSection
                    embedded
                    queueStep={queueStepBySection.overdue}
                    queuePart="overdue"
                    items={standardUrgentAll}
                    todayDateKey={workspace.todayDateKey}
                    supplierMeta={workspace.supplierMeta}
                    showBulkToolbar
                    run={run}
                    onOpenSupplier={onOpenSupplier}
                    onVacation={onVacation}
                    onEdit={onEdit}
                    selected={selected}
                    onToggle={onToggle}
                    onSelectAllInScope={onSelectAllInScope}
                    selectedCount={selectedCount}
                    onBulkOrdered={onBulkOrdered}
                    isScopePending={isScopePending}
                    isBulkPending={isBulkPending}
                  />
                ) : null}

                {hasStockOut ? (
                  <ForSomeoneRequests
                    variant="stockOut"
                    queueStep={queueStepBySection.stockOut}
                    groups={workspace.stockOutLeft}
                    isScopePending={isScopePending}
                    run={run}
                    onOpenSupplier={onOpenSupplier}
                    statsBySupplierId={statsBySupplierId}
                    supplierStatsMode={supplierStatsMode}
                    suppliers={suppliers}
                    salesPeople={salesPeople}
                    supplierMeta={workspace.supplierMeta}
                    todayDateKey={workspace.todayDateKey}
                    weekDays={workspace.thisWeekDays}
                    sectionId="kolejka-brak-na-stanie"
                    highlightFresh={highlightFresh}
                  />
                ) : null}

                {hasForSomeone ? (
                  <ForSomeoneRequests
                    queueStep={queueStepBySection.prosby}
                    groups={workspace.forSomeoneLeft}
                    isScopePending={isScopePending}
                    run={run}
                    onOpenSupplier={onOpenSupplier}
                    statsBySupplierId={statsBySupplierId}
                    supplierStatsMode={supplierStatsMode}
                    suppliers={suppliers}
                    salesPeople={salesPeople}
                    supplierMeta={workspace.supplierMeta}
                    todayDateKey={workspace.todayDateKey}
                    weekDays={workspace.thisWeekDays}
                    highlightFresh={highlightFresh}
                  />
                ) : null}

                {urgentToday.length > 0 ? (
                  <UrgentOrdersSection
                    embedded
                    queueStep={queueStepBySection.today}
                    queuePart="today"
                    items={standardUrgentAll}
                    todayDateKey={workspace.todayDateKey}
                    supplierMeta={workspace.supplierMeta}
                    showBulkToolbar={urgentOverdue.length === 0}
                    run={run}
                    onOpenSupplier={onOpenSupplier}
                    onVacation={onVacation}
                    onEdit={onEdit}
                    selected={selected}
                    onToggle={onToggle}
                    onSelectAllInScope={onSelectAllInScope}
                    selectedCount={selectedCount}
                    onBulkOrdered={onBulkOrdered}
                    isScopePending={isScopePending}
                    isBulkPending={isBulkPending}
                  />
                ) : null}
              </>
            ) : null}
          </div>
        ) : (
          <>
            <EmptyState
              brandAccent
              title="Nic pilnego na dziś"
              description="Brak prośb i harmonogramu na dziś. Sprawdź zakładkę Tydzień lub terminy w kalendarzu."
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
