"use client";

import type { SupplierSubiektScopeInfo } from "@/lib/orders/zd-estimate-supplier-scope";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import type { SummaryWorkspaceData } from "@/lib/orders/summary-workspace";
import type { DeliveryStats, IndividualOrder, StatsMode } from "@/types/database";
import type { SummaryStandardItem } from "@/lib/orders/summary";
import { actionBulkOrdered } from "@/app/actions/admin";
import { NoticeToast } from "@/components/ui/NoticeToast";
import { UndoToast } from "@/components/ui/UndoToast";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { SupplierDrawer } from "@/components/summary/SupplierDrawer";
import { QuickOrderModal } from "@/components/summary/QuickOrderModal";
import dynamic from "next/dynamic";

// Widok „Tydzień” i modale dostawcy — osobne chunki, ładowane dopiero przy otwarciu.
const DailyWeekView = dynamic(() =>
  import("@/components/summary/DailyWeekView").then((m) => m.DailyWeekView)
);
const SupplierVacationModal = dynamic(() =>
  import("@/components/procurement/SupplierVacationModal").then((m) => m.SupplierVacationModal)
);
const SupplierEditModal = dynamic(() =>
  import("@/components/procurement/SupplierEditModal").then((m) => m.SupplierEditModal)
);
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
import { DailyPanelStatusBand } from "@/components/summary/DailyPanelStatusBand";
import { DailyPanelSyncControl } from "@/components/summary/DailyPanelSyncControl";
import { DailyPanelContentFooter } from "@/components/summary/DailyPanelContentFooter";
import { DailyTodayView } from "@/components/summary/DailyTodayView";
import { leadTimeDisplayFromQuantiles } from "@/lib/orders/delivery-eta-quantiles-shared";
import { ActionLoadingOverlay } from "@/components/ui/ActionLoadingOverlay";
import type { OrderFormSupplierOption } from "@/lib/orders/order-form-suppliers";
import type { SupplierDirectoryEntry } from "@/components/procurement/SupplierSearchField";
import { VerificationModal } from "@/components/verification/VerificationModal";
import { OnDemandSuppliersSheet } from "@/components/summary/OnDemandSuppliersSheet";
import { DailyPanelActionsBar } from "@/components/summary/DailyPanelActionsBar";
import { DailyPanelExceptionsView } from "@/components/summary/DailyPanelExceptionsView";
import { OperationsPanelRefreshStrip } from "@/components/operations/OperationsUpdatesContext";
import { BoardQuestionsAttentionNotice } from "@/components/department-board/BoardQuestionsAttentionNotice";
import { SupplierMailBounceNotice } from "@/components/summary/SupplierMailBounceNotice";
import { DailyPanelVerificationBanner } from "@/components/summary/DailyPanelVerificationBanner";
import { PageAttentionGroup } from "@/components/ui/PageAttentionStrip";
import { useUndoShortcutLabel } from "@/lib/platform/keyboard-shortcut-label";
import { dailyPanelWorkspaceShellClass } from "@/lib/ui/ontime-theme";
import { SALES_PAGE_HEADER_HINTS } from "@/lib/sales/sales-page-ui-copy";
import { useClientHydrated } from "@/lib/client/use-client-hydrated";
import type { TeethSupplierLaneSnapshot } from "@/lib/data/teeth-schedule-shared";
import {
  DAILY_PANEL_MARK_ORDERED_PENDING_OVERLAY,
  dailyPanelMarkOrderedToastTitle,
} from "@/lib/orders/daily-panel-mark-ordered-copy";
import { ZD_ESTIMATE_UI } from "@/lib/orders/zd-estimate-ui-copy";
import type {
  StockWatchOffPlanSupplier,
  StockWatchSupplierSignal,
} from "@/lib/stock-watch/data";
import { StockWatchOffPlanBanner } from "@/components/stock-watch/StockWatchOffPlanBanner";
import { DailyZdProposalsProvider, type DailyZdProposal } from "@/components/summary/DailyZdProposals";
import { DailyZdAutomatSection } from "@/components/summary/DailyZdAutomatSection";
import type { ZdAutomatDailyData } from "@/lib/orders/zd-automat-daily";
import {
  SupplierStockSignalsProvider,
  supplierStockSignalRank,
} from "@/components/summary/SupplierStockSignal";

// Paleta „Ustawienia towaru” ciągnie kartę produktu Kreatora — ładowana dopiero przy otwarciu.
const ZdProductSettingsPalette = dynamic(
  () => import("@/components/zakupy/ZdProductSettings").then((m) => ({ default: m.ZdProductSettingsPalette })),
  { ssr: false }
);

export function SummaryWorkspace({
  workspace: workspaceIn,
  stockSignalBySupplierId = {},
  offPlanSuppliers = [],
  autoProposals = [],
  zdAutomat = null,
  nowIso,
  supplierCardsHref = "/zakupy/dostawcy",
  suppliers,
  supplierDirectory,
  salesPeople,
  statsBySupplierId = {},
  supplierStatsMode = {},
  verificationOrders = [],
  teethLaneBySupplierId = {},
  subiektScopeBySupplierId = {},
  canPrepareZd = false,
  etaUseP50 = false,
  etaQuantilesBySupplierId = {},
}: {
  workspace: SummaryWorkspaceData;
  /** Nocna analiza Braki per dostawca (karty: Do ZD / braki / nic do zamówienia). */
  stockSignalBySupplierId?: Record<string, StockWatchSupplierSignal>;
  /** „Zamów dziś poza planem” — braki przed dostawą u dostawców bez planu na dziś. */
  offPlanSuppliers?: StockWatchOffPlanSupplier[];
  /** Zamówienia automatu do potwierdzenia — w wierszu dostawcy harmonogramu (tylko role z Kreatorem). */
  autoProposals?: DailyZdProposal[];
  /** Sekcja „Automat ZD” (dostawcy w automacie, ostatnie propozycje, nocny przebieg); null = brak sekcji. */
  zdAutomat?: ZdAutomatDailyData | null;
  /** Czas z serwera dla sekcji Automat ZD — ten sam wynik na serwerze i w przeglądarce. */
  nowIso?: string;
  /** Karty dostawców dla roli (admin / zakupy) — link „Ustawienia” w sekcji Automat ZD. */
  supplierCardsHref?: string;
  suppliers: OrderFormSupplierOption[];
  supplierDirectory: SupplierDirectoryEntry[];
  salesPeople: { id: string; name: string; email: string }[];
  statsBySupplierId?: Record<string, DeliveryStats>;
  supplierStatsMode?: Record<string, StatsMode>;
  verificationOrders?: IndividualOrder[];
  teethLaneBySupplierId?: Record<string, TeethSupplierLaneSnapshot>;
  /** Dostawca → grupa/cecha Subiekta (mapowanie z kreatora ZD). */
  subiektScopeBySupplierId?: Record<string, SupplierSubiektScopeInfo>;
  /** Przygotuj ZD w drawerze — Kreator ZD (operacje dostaw). */
  canPrepareZd?: boolean;
  etaUseP50?: boolean;
  etaQuantilesBySupplierId?: Record<
    string,
    import("@/lib/orders/delivery-eta-quantiles-load").DeliveryEtaSupplierQuantiles
  >;
}) {
  // „Na żądanie”: najpierw dostawcy z brakami / pozycjami Do ZD (analiza Braki), potem reszta jak było.
  const workspace = useMemo(() => {
    const ranked = workspaceIn.onDemandSuppliers.map((row, i) => ({
      row,
      i,
      rank: supplierStockSignalRank(stockSignalBySupplierId[row.supplierId]),
    }));
    ranked.sort((a, b) => b.rank - a.rank || a.i - b.i);
    return { ...workspaceIn, onDemandSuppliers: ranked.map((r) => r.row) };
  }, [workspaceIn, stockSignalBySupplierId]);
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
  const hydrated = useClientHydrated();
  const undoShortcut = useUndoShortcutLabel();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supplierDeeplinkHandledRef = useRef<string | null>(null);

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
  const [productSettingsOpen, setProductSettingsOpen] = useState(false);
  // ⌘/Ctrl+K — ustawienia towaru (paleta), także gdy fokus jest w polu wyszukiwania dostawcy.
  useEffect(() => {
    if (!canPrepareZd) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.repeat || e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      // Nad innym oknem (karta dostawcy, zamówienie automatu) paleta wylądowałaby pod nim — wtedy nic.
      if (document.querySelector('[aria-modal="true"]')) return;
      setProductSettingsOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canPrepareZd]);

  const verificationCount = verificationOrders.length;
  const exceptionsCount = useMemo(() => countDailyPanelExceptions(workspace), [workspace]);

  const drawerSupplier = drawerId ? workspace.supplierMeta[drawerId] ?? null : null;
  const inboxSummary = useMemo(() => summarizeDailyInbox(workspace), [workspace]);

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

  // Deep-link z kreatora ZD: /podsumowanie?view=dzis&supplierId=…
  useEffect(() => {
    const raw = searchParams.get("supplierId")?.trim() ?? "";
    if (!raw) {
      supplierDeeplinkHandledRef.current = null;
      return;
    }
    if (supplierDeeplinkHandledRef.current === raw) return;
    supplierDeeplinkHandledRef.current = raw;

    const stripSupplierParam = () => {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("supplierId");
      const qs = next.toString();
      router.replace(qs ? `/podsumowanie?${qs}` : "/podsumowanie", {
        scroll: false,
      });
    };

    if (workspace.supplierMeta[raw]) {
      // setState w microtask (eslint); strip sync — URL bez supplierId zanim efekt wpadnie ponownie.
      queueMicrotask(() => openSupplier(raw));
      stripSupplierParam();
      return;
    }
    queueMicrotask(() => {
      notify(ZD_ESTIMATE_UI.postCreateDzisMissingSupplier, "error");
    });
    stripSupplierParam();
  }, [searchParams, workspace.supplierMeta, openSupplier, router, notify]);

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
        // ConfirmDialog (alertdialog) nad szufladą — Escape zamyka tylko dialog.
        if (document.querySelector('[role="alertdialog"]')) return;
        setDrawerId(null);
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    drawerId,
    drawerSupplier,
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
        ? dailyPanelMarkOrderedToastTitle(
            standardUrgentAll.find((item) => selected[item.supplierId])?.supplierName
          )
        : `Oznaczono jako zamówione (${ids.length} dostawców)`,
      ids.length === 1
        ? DAILY_PANEL_MARK_ORDERED_PENDING_OVERLAY
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
    <SupplierStockSignalsProvider signals={stockSignalBySupplierId} canPrepareZd={canPrepareZd}>
    <DailyZdProposalsProvider proposals={canPrepareZd ? autoProposals : []}>
    <div className={dailyPanelWorkspaceShellClass}>
      {pendingMessage ? (
        <ActionLoadingOverlay message={pendingMessage} variant="viewport" />
      ) : null}
      {hydrated
        ? createPortal(
            <>
              {flash && !undo ? (
                <NoticeToast notice={flash} onDismiss={dismissFlash} />
              ) : null}
              {undo ? (
                <UndoToast
                  key={undo.payload.performedAt}
                  title={undo.title}
                  description={undo.description}
                  detailLines={undo.detailLines}
                  expiresAt={undo.expiresAt}
                  placement="floating"
                  onDismiss={dismissUndo}
                  onUndo={handleUndo}
                  undoShortcut={undoShortcut}
                />
              ) : null}
            </>,
            document.body
          )
        : null}

      <PageHeader
        title="Panel dzienny"
        hint={SALES_PAGE_HEADER_HINTS.dailyPanel}
        hintAriaLabel="O panelu dziennym"
        className="mb-3"
      />

      {/* Szukanie i akcje zostają pod ręką przy przewijaniu kolejki — sticky na tle, bez ramki. */}
      <div className="sticky top-0 z-20 -mx-1 flex items-center bg-[var(--background)]/90 px-1 py-2 backdrop-blur-sm">
          <DailyPanelActionsBar
            summary={inboxSummary}
            suppliers={supplierDirectory}
            onNewRequest={() => setOrderModalOpen(true)}
            onSelectSupplier={openSupplier}
            onNewSupplier={() => openEditFor("new")}
            onOpenOnDemand={() => setOnDemandOpen(true)}
            onOpenProductSettings={canPrepareZd ? () => setProductSettingsOpen(true) : undefined}
          />
          {canPrepareZd && productSettingsOpen ? (
            <ZdProductSettingsPalette open={productSettingsOpen} onClose={() => setProductSettingsOpen(false)} canEdit />
          ) : null}
        </div>

      <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <DailyPanelTabs
          active={panelView}
          todayCount={todayQueueCount}
          weekCount={inboxSummary.weekPlanCount}
          verificationCount={verificationCount}
          exceptionsCount={exceptionsCount}
          hideVerificationBadge={hideVerificationDup}
          onChange={setPanelView}
        />
        <DailyPanelSyncControl />
      </div>

      <div className="mt-5 space-y-6">
        <OperationsPanelRefreshStrip />
        {/* Status Panel: stan kolejki dnia — karta nad listami (tylko widok Dziś). */}
        {panelView === "dzis" ? (
          <Card padding={false}>
            <DailyPanelStatusBand
              view={panelView}
              summary={inboxSummary}
              dayProgress={dayProgress}
              dayProgressReady={dayProgressReady}
              verificationCount={verificationCount}
              showVerification={!hideVerificationDup}
              urgentVacationCount={urgentVacationCount}
              cancelledCount={workspace.salesCancelledNotices.length}
              onOpenOnDemand={() => setOnDemandOpen(true)}
            />
          </Card>
        ) : null}

        <PageAttentionGroup>
          <BoardQuestionsAttentionNotice edge="row" suppressPathHide />
          {canPrepareZd ? <SupplierMailBounceNotice edge="row" /> : null}
          {panelView === "dzis" && offPlanSuppliers.length > 0 ? (
            <StockWatchOffPlanBanner suppliers={offPlanSuppliers} canPrepareZd={canPrepareZd} />
          ) : null}
          {panelView === "dzis" ? (
            <DailyPanelVerificationBanner
              count={verificationCount}
              onOpenModal={() => setVerificationModalOpen(true)}
            />
          ) : null}
        </PageAttentionGroup>

        <DailyPanelToolbar
          view={panelView}
          summary={inboxSummary}
          exceptionsCount={exceptionsCount}
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
            onOpenWeek={() => setPanelView("tydzien")}
            highlightFresh={highlightFresh}
            notify={notify}
            etaUseP50={etaUseP50}
            etaQuantilesBySupplierId={etaQuantilesBySupplierId}
            automat={
              canPrepareZd && zdAutomat && zdAutomat.suppliers.length > 0 && nowIso ? (
                <DailyZdAutomatSection data={zdAutomat} nowIso={nowIso} cardsHref={supplierCardsHref} />
              ) : null
            }
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
            className="space-y-6"
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
      </div>

      <SupplierDrawer
        supplier={drawerSupplier}
        vacationWindow={
          drawerId ? workspace.suppliersOnVacationNow[drawerId] ?? null : null
        }
        teethLane={drawerId ? teethLaneBySupplierId[drawerId] ?? null : null}
        subiektScope={drawerId ? subiektScopeBySupplierId[drawerId] ?? null : null}
        deliveryStats={drawerId ? statsBySupplierId[drawerId] ?? null : null}
        statsMode={
          drawerId
            ? supplierStatsMode[drawerId] ??
              drawerSupplier?.stats_mode ??
              "LACZNIE"
            : "LACZNIE"
        }
        leadTimeDisplay={
          drawerId
            ? leadTimeDisplayFromQuantiles(
                etaQuantilesBySupplierId[drawerId],
                etaUseP50
              )
            : undefined
        }
        onClose={() => setDrawerId(null)}
        isScopePending={isScopePending}
        run={run}
        onVacation={() => drawerId && setVacationModalSupplierId(drawerId)}
        onEdit={() => drawerId && openEditFor(drawerId)}
        canPrepareZd={canPrepareZd}
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
        statsBySupplierId={statsBySupplierId}
        etaUseP50={etaUseP50}
        etaQuantilesBySupplierId={etaQuantilesBySupplierId}
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
    </DailyZdProposalsProvider>
    </SupplierStockSignalsProvider>
  );
}
