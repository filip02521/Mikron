"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SummaryWorkspaceData } from "@/lib/orders/summary-workspace";
import type { DeliveryStats, IndividualOrder, StatsMode } from "@/types/database";
import type { SummaryStandardItem } from "@/lib/orders/summary";
import { actionBulkOrdered, actionMarkOrdered } from "@/app/actions/admin";
import { Toast } from "@/components/ui/Toast";
import { UndoToast } from "@/components/ui/UndoToast";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { panelDashedActionClass, panelTextLinkClass } from "@/lib/ui/ontime-theme";
import { WeekPlanner } from "@/components/summary/WeekPlanner";
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
import { dailyPanelIntroDescription } from "@/lib/orders/daily-panel-view";
import { ForSomeoneRequests } from "@/components/summary/ForSomeoneRequests";
import { UrgentOrdersSection } from "@/components/summary/UrgentOrdersSection";
import { useDailyPanelRunner } from "@/components/summary/useDailyPanelRunner";
import { ActionLoadingOverlay } from "@/components/ui/ActionLoadingOverlay";
import { SupplierVacationModal } from "@/components/procurement/SupplierVacationModal";
import { SupplierEditModal } from "@/components/procurement/SupplierEditModal";
import type { SupplierDirectoryEntry } from "@/components/procurement/SupplierSearchField";
import { VerificationModal } from "@/components/verification/VerificationModal";
import { OnDemandSuppliersSheet } from "@/components/summary/OnDemandSuppliersSheet";
import { DailyPanelActionsBar } from "@/components/summary/DailyPanelActionsBar";
import { DailyPanelExceptionsView } from "@/components/summary/DailyPanelExceptionsView";
import { DailyPanelQueueSteps } from "@/components/summary/DailyPanelQueueSteps";
import { SectionListLabel } from "@/components/ui/SectionListLabel";
import {
  DailySectionIcon,
  dailySectionIconTileClass,
  IconLayoutPanel,
} from "@/components/icons/StrokeIcons";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { brandIconTileClass, sidebarBrandAccentClass } from "@/lib/ui/ontime-theme";
import { ProsbaFormSection } from "@/components/orders/ProsbaFormSection";
import { cn } from "@/lib/cn";
import { DailyPanelVerificationBanner } from "@/components/summary/DailyPanelVerificationBanner";

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
  suppliers: { id: string; name: string }[];
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
  } = useDailyPanelRunner();

  const { view: panelView, setView: setPanelView } = useDailyPanelView();
  const panelIntro = dailyPanelIntroDescription(panelView);

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [showNextWeek, setShowNextWeek] = useState(false);
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
  const dayProgress = useDailyDayProgress(urgentRemainingTotal, forSomeoneRemaining);

  const { overdue: urgentOverdue, todayList: urgentToday } = useMemo(
    () => splitUrgentItems(standardUrgentAll),
    [standardUrgentAll]
  );

  const todayQueueCount =
    inboxSummary.overdueCount +
    inboxSummary.todayCount +
    inboxSummary.forSomeoneGroupCount;

  const hasForSomeone = workspace.forSomeoneLeft.length > 0;
  const hasUrgentSchedule = urgentOverdue.length > 0 || urgentToday.length > 0;
  const hasTodayWork = hasForSomeone || hasUrgentSchedule;

  const queueStepBySection = useMemo(() => {
    let step = 0;
    const next = () => ++step;
    return {
      overdue: urgentOverdue.length > 0 ? next() : undefined,
      prosby: hasForSomeone ? next() : undefined,
      today: urgentToday.length > 0 ? next() : undefined,
    };
  }, [urgentOverdue.length, hasForSomeone, urgentToday.length]);

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
    <div className="relative mx-auto max-w-6xl">
      {pendingMessage ? (
        <ActionLoadingOverlay message={pendingMessage} variant="viewport" />
      ) : null}
      {flash && !undo ? (
        <Toast message={flash.text} tone={flash.tone} onDismiss={dismissFlash} />
      ) : null}
      {undo ? (
        <UndoToast
          message={undo.message}
          detailLines={undo.detailLines}
          onDismiss={dismissUndo}
          onUndo={handleUndo}
          durationMs={5000}
        />
      ) : null}

      <Card padding={false} className="overflow-hidden">
        <div className={cn(sidebarBrandAccentClass, "rounded-none opacity-75")} aria-hidden />
        <CardHeader
          inset
          leading={
            <SectionHeadingIcon tileClassName={brandIconTileClass}>
              <IconLayoutPanel size={20} />
            </SectionHeadingIcon>
          }
          title="Panel dzienny"
          description={panelIntro}
          action={
            <div className="w-full min-w-0 lg:max-w-xl">
              <DailyPanelActionsBar
                summary={inboxSummary}
                suppliers={supplierDirectory}
                onNewRequest={() => setOrderModalOpen(true)}
                onSelectSupplier={openSupplier}
                onNewSupplier={() => openEditFor("new")}
                onOpenOnDemand={() => setOnDemandOpen(true)}
              />
            </div>
          }
        />

        <DailyPanelTabs
          active={panelView}
          todayCount={todayQueueCount}
          weekCount={inboxSummary.weekPlanCount}
          verificationCount={verificationCount}
          exceptionsCount={exceptionsCount}
          onChange={setPanelView}
        />

        <DailyPanelToolbar
          view={panelView}
          summary={inboxSummary}
          dayProgress={dayProgress}
          urgentVacationCount={urgentVacationCount}
          exceptionsCount={exceptionsCount}
          verificationCount={verificationCount}
          onOpenOnDemand={() => setOnDemandOpen(true)}
        />

        {panelView === "dzis" ? (
          <>
            <SectionListLabel
              id="dzis"
              title="Do obsługi dziś"
              hint="Kolejka: zaległe → prośby handlowców → na dziś"
              count={todayQueueCount}
              accent="emerald"
              icon={<DailySectionIcon kind="dzis" size={17} />}
              tileClassName={dailySectionIconTileClass("dzis")}
            />
            <div
              id="panel-view-dzis"
              role="tabpanel"
              aria-labelledby="panel-tab-dzis"
              className="space-y-4 px-4 py-5 sm:px-6"
            >
              {!hasTodayWork && verificationCount === 0 ? (
                <EmptyState
                  title="Nic pilnego na dziś"
                  description="Brak prośb i harmonogramu na dziś. Sprawdź zakładkę Tydzień."
                  icon={<DailySectionIcon kind="dzis" size={28} />}
                  action={
                    <Button variant="secondary" size="sm" onClick={() => setPanelView("tydzien")}>
                      Plan tygodnia
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-6">
                  {verificationCount > 0 ? (
                    <DailyPanelVerificationBanner
                      count={verificationCount}
                      onOpenModal={() => setVerificationModalOpen(true)}
                    />
                  ) : null}
                  <DailyPanelQueueSteps
                    overdueCount={inboxSummary.overdueCount}
                    forSomeoneGroupCount={inboxSummary.forSomeoneGroupCount}
                    todayCount={inboxSummary.todayCount}
                  />
                  {urgentOverdue.length > 0 ? (
                    <UrgentOrdersSection
                      embedded
                      queueStep={queueStepBySection.overdue}
                      queuePart="overdue"
                      items={standardUrgentAll}
                      supplierMeta={workspace.supplierMeta}
                      showBulkToolbar
                      run={run}
                      onOpenSupplier={openSupplier}
                      onVacation={openVacationFor}
                      onEdit={(id) => openEditFor(id)}
                      selected={selected}
                      onToggle={toggle}
                      onSelectAllInScope={selectUrgentScope}
                      selectedCount={selectedCount}
                      onBulkOrdered={processBulk}
                      isScopePending={isScopePending}
                      isBulkPending={isBulkPending}
                    />
                  ) : null}

                  {hasForSomeone ? (
                    <ForSomeoneRequests
                      embedded
                      queueStep={queueStepBySection.prosby}
                      groups={workspace.forSomeoneLeft}
                      isScopePending={isScopePending}
                      run={run}
                      onOpenSupplier={openSupplier}
                      statsBySupplierId={statsBySupplierId}
                      supplierStatsMode={supplierStatsMode}
                      suppliers={suppliers}
                      salesPeople={salesPeople}
                    />
                  ) : null}

                  {urgentToday.length > 0 ? (
                    <UrgentOrdersSection
                      embedded
                      queueStep={queueStepBySection.today}
                      queuePart="today"
                      items={standardUrgentAll}
                      supplierMeta={workspace.supplierMeta}
                      showBulkToolbar={urgentOverdue.length === 0}
                      run={run}
                      onOpenSupplier={openSupplier}
                      onVacation={openVacationFor}
                      onEdit={(id) => openEditFor(id)}
                      selected={selected}
                      onToggle={toggle}
                      onSelectAllInScope={selectUrgentScope}
                      selectedCount={selectedCount}
                      onBulkOrdered={processBulk}
                      isScopePending={isScopePending}
                      isBulkPending={isBulkPending}
                    />
                  ) : null}
                </div>
              )}
            </div>
          </>
        ) : null}

        {panelView === "tydzien" ? (
          <>
            <SectionListLabel
              id="plan"
              title="Plan tygodnia"
              hint="Przyszłe terminy — zamówienie z wyprzedzeniem lub tryb planowania"
              accent="indigo"
              icon={<DailySectionIcon kind="plan" size={17} />}
              tileClassName={dailySectionIconTileClass("plan")}
            />
            <div
              id="panel-view-tydzien"
              role="tabpanel"
              aria-labelledby="panel-tab-tydzien"
              className="space-y-4 px-4 py-5 pb-6 sm:px-6"
            >
              {workspace.onDemandSuppliers.length > 0 ? (
                <ProsbaFormSection
                  title="Dostawcy na żądanie"
                  hint="Bez stałego terminu w harmonogramie — zamów, gdy coś jest potrzebne."
                >
                  <button
                    type="button"
                    className={cn("text-sm", panelTextLinkClass)}
                    onClick={() => setOnDemandOpen(true)}
                  >
                    Pokaż listę ({workspace.onDemandSuppliers.length}{" "}
                    {workspace.onDemandSuppliers.length === 1 ? "dostawca" : "dostawców"})
                  </button>
                </ProsbaFormSection>
              ) : null}

              <WeekPlanner
                title="Ten tydzień"
                description="Poniedziałek–piątek · zamówione z wyprzedzeniem lub szczegóły dostawcy"
                days={workspace.thisWeekDays}
                onOpenSupplier={openSupplier}
                onVacation={openVacationFor}
                onEdit={(id) => openEditFor(id)}
                run={run}
                isScopePending={isScopePending}
                isPlanPending={isPlanPending}
              />

              {showNextWeek ? (
                <>
                  <WeekPlanner
                    title="Następny tydzień"
                    description="Ten sam układ co bieżący tydzień"
                    days={workspace.nextWeekDays}
                    onOpenSupplier={openSupplier}
                    onVacation={openVacationFor}
                    onEdit={(id) => openEditFor(id)}
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
                  className={panelDashedActionClass}
                >
                  Pokaż następny tydzień
                </button>
              )}
            </div>
          </>
        ) : null}

        {panelView === "wyjatki" ? (
          <>
            <SectionListLabel
              id="wyjatki"
              title="Wyjątki"
              hint="Rezygnacje · informacja · na żądanie · poza harmonogramem"
              accent="indigo"
              icon={<DailySectionIcon kind="hidden" size={17} />}
              tileClassName={dailySectionIconTileClass("hidden")}
            />
            <div
              id="panel-view-wyjatki"
              role="tabpanel"
              aria-labelledby="panel-tab-wyjatki"
              className="space-y-4 px-4 py-5 sm:px-6"
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
          </>
        ) : null}
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
          supplierId={vacationModalSupplierId}
          supplierName={vacationModalName}
          onClose={() => setVacationModalSupplierId(null)}
          onSaved={(msg) => appendFlash(msg)}
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
