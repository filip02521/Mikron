"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SummaryWorkspaceData } from "@/lib/orders/summary-workspace";
import type { DeliveryStats, IndividualOrder, StatsMode } from "@/types/database";
import type { SummaryStandardItem } from "@/lib/orders/summary";
import { actionBulkOrdered, actionMarkOrdered } from "@/app/actions/admin";
import { Toast } from "@/components/ui/Toast";
import { UndoToast } from "@/components/ui/UndoToast";
import { Card, CardHeader } from "@/components/ui/Card";
import { SupplierDrawer } from "@/components/summary/SupplierDrawer";
import { QuickOrderModal } from "@/components/summary/QuickOrderModal";
import {
  countDailyPanelExceptions,
  countUrgentItemsWithVacation,
  splitUrgentItems,
  summarizeDailyInbox,
} from "@/lib/orders/procurement-daily-ui";
import { useDailyDayProgress } from "@/hooks/useDailyDayProgress";
import {
  DAILY_PANEL_SCOPE_BULK,
  DAILY_PANEL_SCOPE_GLOBAL,
} from "@/components/summary/useDailyPanelRunner";
import { DailyPanelToolbar } from "@/components/summary/DailyPanelToolbar";
import { DailyPanelTabs } from "@/components/summary/DailyPanelTabs";
import { useDailyPanelView } from "@/hooks/useDailyPanelView";
import { useDailyPanelFreshHighlight } from "@/hooks/useDailyPanelFreshHighlight";
import { useDailyPanelRunner } from "@/components/summary/useDailyPanelRunner";
import { DailyPanelStickyFooter } from "@/components/summary/DailyPanelStickyFooter";
import { DailyPanelContentFooter } from "@/components/summary/DailyPanelContentFooter";
import { DailyTodayView } from "@/components/summary/DailyTodayView";
import { DailyWeekView } from "@/components/summary/DailyWeekView";
import { ActionLoadingOverlay } from "@/components/ui/ActionLoadingOverlay";
import { SupplierVacationModal } from "@/components/procurement/SupplierVacationModal";
import { SupplierEditModal } from "@/components/procurement/SupplierEditModal";
import type { SupplierDirectoryEntry } from "@/components/procurement/SupplierSearchField";
import { VerificationModal } from "@/components/verification/VerificationModal";
import { OnDemandSuppliersSheet } from "@/components/summary/OnDemandSuppliersSheet";
import { DailyPanelActionsBar } from "@/components/summary/DailyPanelActionsBar";
import { DailyPanelExceptionsView } from "@/components/summary/DailyPanelExceptionsView";
import { OperationsPanelRefreshStrip } from "@/components/operations/OperationsUpdatesContext";
import { DailyPanelBoardQuestionsBanner } from "@/components/summary/DailyPanelBoardQuestionsBanner";
import {
  IconLayoutPanel,
} from "@/components/icons/StrokeIcons";
import { useUndoShortcutLabel } from "@/lib/platform/keyboard-shortcut-label";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { brandIconTileClass, panelChromeInsetClass, panelSectionInsetClass, panelWorkspaceShellClass } from "@/lib/ui/ontime-theme";
import { SALES_PAGE_HEADER_HINTS } from "@/lib/sales/sales-page-ui-copy";
import { cn } from "@/lib/cn";
import type { OrderFormSupplierOption } from "@/lib/orders/order-form-suppliers";

export function SummaryWorkspace({
  workspace,
  suppliers,
  supplierDirectory,
  salesPeople,
  statsBySupplierId = {},
  supplierStatsMode = {},
  verificationOrders = [],
}: {
  workspace: SummaryWorkspaceData;
  suppliers: OrderFormSupplierOption[];
  supplierDirectory: SupplierDirectoryEntry[];
  salesPeople: { id: string; name: string; email: string }[];
  statsBySupplierId?: Record<string, DeliveryStats>;
  supplierStatsMode?: Record<string, StatsMode>;
  verificationOrders?: IndividualOrder[];
}) {
  const {
    pendingMessage,
    isScopePending,
    isBulkPending,
    isPlanPending,
    run,
    undo,
    dismissUndo,
    handleUndo,
    flash,
    dismissFlash,
    notify,
  } = useDailyPanelRunner();

  const { view: panelView, setView: setPanelView } = useDailyPanelView();
  const highlightFresh = useDailyPanelFreshHighlight();
  const undoShortcut = useUndoShortcutLabel();

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [vacationModalSupplierId, setVacationModalSupplierId] = useState<string | null>(
    null
  );
  const [editModalSupplierId, setEditModalSupplierId] = useState<string | null | "new">(
    null
  );
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);
  const [onDemandOpen, setOnDemandOpen] = useState(false);

  const verificationCount = verificationOrders.length;
  const exceptionsCount = countDailyPanelExceptions(workspace);

  const drawerSupplier = drawerId ? workspace.supplierMeta[drawerId] ?? null : null;
  const inboxSummary = summarizeDailyInbox(workspace);

  const standardUrgentAll = useMemo(
    () =>
      workspace.left.filter((i): i is SummaryStandardItem => i.kind === "standard"),
    [workspace.left]
  );

  const urgentVacationCount = useMemo(
    () => countUrgentItemsWithVacation(standardUrgentAll),
    [standardUrgentAll]
  );

  const urgentRemainingTotal = inboxSummary.overdueCount + inboxSummary.todayCount;
  const forSomeoneRemaining = workspace.forSomeoneLeft.length;
  const stockOutRemaining = workspace.stockOutLeft.length;
  const { progress: dayProgress, ready: dayProgressReady } = useDailyDayProgress(
    urgentRemainingTotal,
    forSomeoneRemaining + stockOutRemaining
  );

  const { overdue: urgentOverdue, todayList: urgentToday } = useMemo(
    () => splitUrgentItems(standardUrgentAll, workspace.todayDateKey),
    [standardUrgentAll, workspace.todayDateKey]
  );

  const hasCancelled = workspace.salesCancelledNotices.length > 0;
  const hasForSomeone = workspace.forSomeoneLeft.length > 0;
  const hasStockOut = workspace.stockOutLeft.length > 0;
  const hasUrgentSchedule = urgentOverdue.length > 0 || urgentToday.length > 0;
  const hasTodayWork = hasForSomeone || hasStockOut || hasUrgentSchedule;

  const todayQueueCount =
    inboxSummary.overdueCount +
    inboxSummary.todayCount +
    inboxSummary.forSomeoneGroupCount +
    inboxSummary.stockOutGroupCount +
    (hasCancelled ? workspace.salesCancelledNotices.length : 0);
  const hideVerificationDup =
    panelView === "dzis" && verificationCount > 0;

  const queueStepBySection = useMemo(() => {
    let step = 0;
    const next = () => ++step;
    return {
      overdue: urgentOverdue.length > 0 ? next() : undefined,
      stockOut: hasStockOut ? next() : undefined,
      prosby: hasForSomeone ? next() : undefined,
      today: urgentToday.length > 0 ? next() : undefined,
    };
  }, [urgentOverdue.length, hasStockOut, hasForSomeone, urgentToday.length]);

  const openSupplier = useCallback((id: string) => setDrawerId(id), []);

  const openVacationFor = useCallback((id: string) => {
    setDrawerId(id);
    setVacationModalSupplierId(id);
  }, []);

  const openEditFor = useCallback((id: string | "new") => {
    if (id === "new") {
      setEditModalSupplierId("new");
      return;
    }
    setDrawerId(id);
    setEditModalSupplierId(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        if (e.key === "Escape") (e.target as HTMLElement).blur();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "z" && undo) {
        e.preventDefault();
        handleUndo();
        return;
      }

      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        const blocked =
          orderModalOpen ||
          verificationModalOpen ||
          editModalSupplierId !== null ||
          vacationModalSupplierId !== null ||
          onDemandOpen;
        if (!blocked) {
          e.preventDefault();
          document.getElementById("supplier-search")?.focus();
        }
        return;
      }

      if (!drawerId || !drawerSupplier) return;

      if (e.key === "Escape") {
        setDrawerId(null);
        return;
      }
      if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        run(
          () => actionMarkOrdered(drawerId),
          "Oznaczono jako zamówione",
          "Oznaczanie jako zamówione…",
          { scope: drawerId }
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    drawerId,
    drawerSupplier,
    run,
    undo,
    handleUndo,
    orderModalOpen,
    verificationModalOpen,
    editModalSupplierId,
    vacationModalSupplierId,
    onDemandOpen,
  ]);

  const toggle = (supplierId: string) =>
    setSelected((s) => ({ ...s, [supplierId]: !s[supplierId] }));

  const selectUrgentScope = useCallback((checked: boolean, supplierIds: string[]) => {
    setSelected((prev) => {
      if (!checked) {
        const next = { ...prev };
        supplierIds.forEach((id) => delete next[id]);
        return next;
      }
      const next = { ...prev };
      supplierIds.forEach((id) => {
        next[id] = true;
      });
      return next;
    });
  }, []);

  const selectedCount = Object.values(selected).filter(Boolean).length;

  const processBulk = () => {
    const ids = standardUrgentAll
      .filter((item) => selected[item.supplierId])
      .map((item) => item.supplierId);
    if (!ids.length) return;
    run(
      () => actionBulkOrdered(ids),
      ids.length === 1
        ? "Oznaczono jako zamówione."
        : `Oznaczono jako zamówione (${ids.length} dostawców).`,
      ids.length === 1
        ? "Oznaczanie jako zamówione…"
        : `Oznaczanie ${ids.length} dostawców…`,
      { scope: DAILY_PANEL_SCOPE_BULK }
    );
    setSelected({});
  };

  const vacationModalName =
    vacationModalSupplierId &&
    (workspace.supplierMeta[vacationModalSupplierId]?.name ??
      supplierDirectory.find((s) => s.id === vacationModalSupplierId)?.name ??
      "Dostawca");

  const editModalSupplier =
    editModalSupplierId === "new"
      ? null
      : editModalSupplierId
        ? workspace.supplierMeta[editModalSupplierId] ?? null
        : null;

  const appendFlash = (text: string) => {
    run(
      async () => ({ success: true as const }),
      text,
      "Odświeżanie panelu…",
      { scope: DAILY_PANEL_SCOPE_GLOBAL, overlay: true }
    );
  };

  return (
    <div className={panelWorkspaceShellClass}>
      {pendingMessage ? (
        <ActionLoadingOverlay message={pendingMessage} variant="viewport" />
      ) : null}
      {flash && !undo ? (
        <Toast message={flash.text} tone={flash.tone} onDismiss={dismissFlash} />
      ) : null}
      {undo ? (
        <UndoToast
          title={undo.title}
          description={undo.description}
          detailLines={undo.detailLines}
          expiresAt={undo.expiresAt}
          placement="inline"
          onDismiss={dismissUndo}
          onUndo={handleUndo}
          undoShortcut={undoShortcut}
        />
      ) : null}

      <Card padding={false} className="overflow-x-clip">
        <CardHeader
          inset
          density="compact"
          leading={
            <SectionHeadingIcon tileClassName={brandIconTileClass}>
              <IconLayoutPanel size={20} />
            </SectionHeadingIcon>
          }
          title="Panel dzienny"
          hint={SALES_PAGE_HEADER_HINTS.dailyPanel}
          hintAriaLabel="O panelu dziennym"
        />

        <div className={cn(panelChromeInsetClass, "flex items-center border-b border-slate-100 py-2.5 sm:py-3")}>
          <DailyPanelActionsBar
            summary={inboxSummary}
            suppliers={supplierDirectory}
            onNewRequest={() => setOrderModalOpen(true)}
            onSelectSupplier={openSupplier}
            onNewSupplier={() => openEditFor("new")}
            onOpenOnDemand={() => setOnDemandOpen(true)}
          />
        </div>

        <DailyPanelTabs
          active={panelView}
          todayCount={todayQueueCount}
          weekCount={inboxSummary.weekPlanCount}
          verificationCount={verificationCount}
          exceptionsCount={exceptionsCount}
          hideVerificationBadge={hideVerificationDup}
          onChange={setPanelView}
          footer={<OperationsPanelRefreshStrip />}
          afterFooter={
            <DailyPanelStickyFooter
              view={panelView}
              summary={inboxSummary}
              dayProgress={dayProgress}
              dayProgressReady={dayProgressReady}
              verificationCount={verificationCount}
              showVerification={!hideVerificationDup}
              urgentVacationCount={urgentVacationCount}
              onOpenOnDemand={() => setOnDemandOpen(true)}
            />
          }
        />

        <DailyPanelBoardQuestionsBanner
          className={cn(panelChromeInsetClass, "border-b border-slate-100 px-3 py-2 sm:px-4")}
        />

        <DailyPanelToolbar
          view={panelView}
          summary={inboxSummary}
          dayProgress={dayProgress}
          urgentVacationCount={urgentVacationCount}
          exceptionsCount={exceptionsCount}
          verificationCount={verificationCount}
          hideVerificationMetric={hideVerificationDup}
          onOpenOnDemand={() => setOnDemandOpen(true)}
        />

        {panelView === "dzis" ? (
          <DailyTodayView
            workspace={workspace}
            verificationCount={verificationCount}
            hasTodayWork={hasTodayWork}
            hasForSomeone={hasForSomeone}
            hasStockOut={hasStockOut}
            urgentOverdue={urgentOverdue}
            urgentToday={urgentToday}
            standardUrgentAll={standardUrgentAll}
            queueStepBySection={queueStepBySection}
            selected={selected}
            selectedCount={selectedCount}
            isScopePending={isScopePending}
            isBulkPending={isBulkPending}
            statsBySupplierId={statsBySupplierId}
            supplierStatsMode={supplierStatsMode}
            suppliers={suppliers}
            salesPeople={salesPeople}
            run={run}
            onOpenSupplier={openSupplier}
            onVacation={openVacationFor}
            onEdit={(id) => openEditFor(id)}
            onToggle={toggle}
            onSelectAllInScope={selectUrgentScope}
            onBulkOrdered={processBulk}
            onOpenVerification={() => setVerificationModalOpen(true)}
            onOpenWeek={() => setPanelView("tydzien")}
            highlightFresh={highlightFresh}
          />
        ) : null}

        {panelView === "tydzien" ? (
          <DailyWeekView
            workspace={workspace}
            run={run}
            isScopePending={isScopePending}
            isPlanPending={isPlanPending}
            onOpenSupplier={openSupplier}
            onVacation={openVacationFor}
            onEdit={(id) => openEditFor(id)}
            onOpenOnDemand={() => setOnDemandOpen(true)}
          />
        ) : null}

        {panelView === "wyjatki" ? (
          <div
            id="panel-view-wyjatki"
            role="tabpanel"
            aria-labelledby="panel-tab-wyjatki"
            className={cn("space-y-3", panelSectionInsetClass)}
          >
            <DailyPanelExceptionsView
                workspace={workspace}
                isScopePending={isScopePending}
                run={run}
                onOpenSupplier={openSupplier}
                onOpenOnDemand={() => setOnDemandOpen(true)}
                onGoToday={() => setPanelView("dzis")}
            />
          </div>
        ) : null}

        <DailyPanelContentFooter />
      </Card>

      <SupplierDrawer
        supplier={drawerSupplier}
        onClose={() => setDrawerId(null)}
        isScopePending={isScopePending}
        run={run}
        onVacation={() => drawerId && setVacationModalSupplierId(drawerId)}
        onEdit={() => drawerId && openEditFor(drawerId)}
      />

      {vacationModalSupplierId && vacationModalName ? (
        <SupplierVacationModal
          key={vacationModalSupplierId}
          supplierId={vacationModalSupplierId}
          supplierName={vacationModalName}
          onClose={() => setVacationModalSupplierId(null)}
          onSaved={(msg) => appendFlash(msg)}
          onError={(msg) => notify(msg, "error")}
        />
      ) : null}

      {editModalSupplierId !== null ? (
        <SupplierEditModal
          key={editModalSupplierId ?? "new"}
          supplier={editModalSupplier}
          onClose={() => setEditModalSupplierId(null)}
          onSaved={(_id, msg) => appendFlash(msg)}
        />
      ) : null}

      <QuickOrderModal
        open={orderModalOpen}
        onClose={() => setOrderModalOpen(false)}
        suppliers={suppliers}
        salesPeople={salesPeople}
      />

      <VerificationModal
        open={verificationModalOpen}
        onClose={() => setVerificationModalOpen(false)}
        orders={verificationOrders}
        suppliers={suppliers}
        salesPeople={salesPeople}
      />

      <OnDemandSuppliersSheet
        open={onDemandOpen}
        suppliers={workspace.onDemandSuppliers}
        isScopePending={isScopePending}
        onClose={() => setOnDemandOpen(false)}
        onOpenSupplier={(id) => {
          setOnDemandOpen(false);
          openSupplier(id);
        }}
        run={run}
      />
    </div>
  );
}
