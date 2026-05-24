"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SummaryWorkspaceData } from "@/lib/orders/summary-workspace";
import type { DeliveryStats, IndividualOrder, StatsMode } from "@/types/database";
import type { SummaryStandardItem } from "@/lib/orders/summary";
import { actionBulkOrdered, actionMarkOrdered } from "@/app/actions/admin";
import { Toast } from "@/components/ui/Toast";
import { UndoToast } from "@/components/ui/UndoToast";
import { EmptyState } from "@/components/ui/EmptyState";
import { WeekPlanner } from "@/components/summary/WeekPlanner";
import { SupplierDrawer } from "@/components/summary/SupplierDrawer";
import { QuickOrderModal } from "@/components/summary/QuickOrderModal";
import {
  countUrgentItemsWithVacation,
  summarizeDailyInbox,
} from "@/lib/orders/procurement-daily-ui";
import { useDailyUrgentProgress } from "@/hooks/useDailyUrgentProgress";
import { DailyPanelToolbar } from "@/components/summary/DailyPanelToolbar";
import { DailyPanelNav } from "@/components/summary/DailyPanelNav";
import { DailyPanelSection } from "@/components/summary/DailyPanelSection";
import { ForSomeoneRequests } from "@/components/summary/ForSomeoneRequests";
import { SalesCancelledDailyCompact } from "@/components/summary/SalesCancelledDailyCompact";
import { UrgentOrdersSection } from "@/components/summary/UrgentOrdersSection";
import { useDailyPanelRunner } from "@/components/summary/useDailyPanelRunner";
import { ActionLoadingOverlay } from "@/components/ui/ActionLoadingOverlay";
import { SupplierVacationModal } from "@/components/procurement/SupplierVacationModal";
import { SupplierEditModal } from "@/components/procurement/SupplierEditModal";
import type { SupplierDirectoryEntry } from "@/components/procurement/SupplierSearchField";
import { VerificationPendingBanner } from "@/components/verification/VerificationPendingBanner";
import { VerificationModal } from "@/components/verification/VerificationModal";
import { OnDemandSuppliersSheet } from "@/components/summary/OnDemandSuppliersSheet";
import { DailyPanelHiddenSuppliers } from "@/components/summary/DailyPanelHiddenSuppliers";

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
  salesPeople: { id: string; name: string }[];
  statsBySupplierId?: Record<string, DeliveryStats>;
  supplierStatsMode?: Record<string, StatsMode>;
  verificationOrders?: IndividualOrder[];
}) {
  const {
    pending,
    pendingMessage,
    run,
    undo,
    dismissUndo,
    handleUndo,
    flash,
    dismissFlash,
  } = useDailyPanelRunner();

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
  const urgentProgress = useDailyUrgentProgress(urgentRemainingTotal);

  const hasForSomeone = workspace.forSomeoneLeft.length > 0;
  const hasUrgent = standardUrgentAll.length > 0;
  const hasSalesCancelled = workspace.salesCancelledNotices.length > 0;
  const hasTodayWork = hasForSomeone || hasUrgent || hasSalesCancelled;

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
        e.preventDefault();
        document.getElementById("supplier-search")?.focus();
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
          "Oznaczanie jako zamówione…"
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerId, drawerSupplier, run]);

  const toggle = (supplierId: string) =>
    setSelected((s) => ({ ...s, [supplierId]: !s[supplierId] }));

  const selectAllUrgent = (checked: boolean) => {
    if (!checked) {
      setSelected({});
      return;
    }
    const next: Record<string, boolean> = {};
    standardUrgentAll.forEach((item) => {
      next[item.supplierId] = true;
    });
    setSelected(next);
  };

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
        : `Oznaczanie ${ids.length} dostawców…`
    );
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
      "Odświeżanie panelu…"
    );
  };

  return (
    <div className="relative space-y-6">
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

      <DailyPanelToolbar
        summary={inboxSummary}
        urgentProgress={urgentProgress}
        urgentVacationCount={urgentVacationCount}
        suppliers={supplierDirectory}
        onNewRequest={() => setOrderModalOpen(true)}
        onSelectSupplier={openSupplier}
        onNewSupplier={() => openEditFor("new")}
        onOpenOnDemand={() => setOnDemandOpen(true)}
      />

      <DailyPanelHiddenSuppliers
        report={workspace.panelHidden}
        onOpenSupplier={openSupplier}
        onOpenOnDemand={() => setOnDemandOpen(true)}
      />

      <DailyPanelNav />

      <DailyPanelSection
        id="dzis"
        step={1}
        title="Do obsługi dziś"
        description="Prośby handlowców i zamówienia według harmonogramu. Po każdej akcji masz 5 s na cofnięcie."
      >
        {verificationCount > 0 ? (
          <VerificationPendingBanner
            count={verificationCount}
            onOpen={() => setVerificationModalOpen(true)}
          />
        ) : null}

        {workspace.salesCancelledNotices.length > 0 ? (
          <SalesCancelledDailyCompact
            notices={workspace.salesCancelledNotices}
            pending={pending}
            run={run}
          />
        ) : null}

        {!hasTodayWork &&
        verificationCount === 0 &&
        workspace.salesCancelledNotices.length === 0 ? (
          <EmptyState
            title="Nic pilnego na dziś"
            description="Brak prośb handlowców i zamówień po terminie. Sprawdź plan tygodnia poniżej."
          />
        ) : (
          <>
            {hasForSomeone ? (
              <ForSomeoneRequests
                groups={workspace.forSomeoneLeft}
                pending={pending}
                run={run}
                onOpenSupplier={openSupplier}
                statsBySupplierId={statsBySupplierId}
                supplierStatsMode={supplierStatsMode}
                suppliers={suppliers}
                salesPeople={salesPeople}
              />
            ) : null}

            {hasUrgent ? (
              <UrgentOrdersSection
                items={standardUrgentAll}
                supplierMeta={workspace.supplierMeta}
                urgentProgress={urgentProgress}
                pending={pending}
                run={run}
                onOpenSupplier={openSupplier}
                onVacation={openVacationFor}
                onEdit={(id) => openEditFor(id)}
                selected={selected}
                onToggle={toggle}
                onSelectAll={selectAllUrgent}
                selectedCount={selectedCount}
                onBulkOrdered={processBulk}
              />
            ) : null}
          </>
        )}
      </DailyPanelSection>

      <DailyPanelSection
        id="plan"
        step={2}
        title="Plan tygodnia"
        description="Przyszłe terminy — możesz oznaczyć zamówienie z wyprzedzeniem. Zaległe i na dziś obsługujesz w sekcji powyżej."
      >
        {workspace.onDemandSuppliers.length > 0 ? (
          <p className="-mt-2 text-sm text-slate-600">
            <button
              type="button"
              className="font-medium text-violet-800 underline decoration-violet-200 underline-offset-2 hover:text-violet-950"
              onClick={() => setOnDemandOpen(true)}
            >
              Dostawcy w razie potrzeby ({workspace.onDemandSuppliers.length})
            </button>
            <span className="text-slate-500">
              {" "}
              — bez stałego terminu; zamów, gdy coś jest potrzebne.
            </span>
          </p>
        ) : null}
        <WeekPlanner
          title="Ten tydzień"
          description="Poniedziałek–piątek · Zamówione z wyprzedzeniem lub szczegóły dostawcy"
          days={workspace.thisWeekDays}
          onOpenSupplier={openSupplier}
          run={run}
          pending={pending}
        />

        {showNextWeek ? (
          <>
            <WeekPlanner
              title="Następny tydzień"
              description="Zamówienia z wyprzedzeniem — ten sam przycisk co w bieżącym tygodniu"
              days={workspace.nextWeekDays}
              onOpenSupplier={openSupplier}
              run={run}
              pending={pending}
            />
            <button
              type="button"
              onClick={() => setShowNextWeek(false)}
              className="text-sm font-medium text-slate-500 hover:text-slate-800"
            >
              Ukryj następny tydzień
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowNextWeek(true)}
            className="w-full rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
          >
            Pokaż następny tydzień
          </button>
        )}
      </DailyPanelSection>

      <SupplierDrawer
        supplier={drawerSupplier}
        onClose={() => setDrawerId(null)}
        pending={pending}
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
        pending={pending}
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
