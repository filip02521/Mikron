"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTeethProductInfo } from "@/components/layout/TeethExemptContext";
import { plPozycja, plZaznaczonaPozycja } from "@/lib/ui/polish-plurals";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { NoticeToast } from "@/components/ui/NoticeToast";
import {
  TEETH_PANEL_TOAST,
  teethMarkOrderedToast,
  toastFromError,
  toastSuccess,
  type ToastNotice,
} from "@/lib/ui/notice-copy";
import { Input } from "@/components/ui/Field";
import { IconTooth, IconCircleCheck } from "@/components/icons/StrokeIcons";
import type { TeethQueueGroup, TeethQueueItem, TeethPositionSelection } from "@/lib/data/teeth-queue";
import { isScheduledItem } from "@/lib/data/teeth-queue";
import { TeethPanelTabs } from "@/components/zeby/TeethPanelTabs";
import {
  TEETH_TAB_HINTS,
  TEETH_TAB_PAGE_TITLES,
} from "@/components/zeby/teeth-panel-copy";
import { TeethPanelEmpty, TeethPanelTabPanel } from "@/components/zeby/TeethPanelSection";
import { TeethPanelWorkspaceCard } from "@/components/zeby/TeethPanelWorkspaceCard";
import { TeethPanelFiltersBar } from "@/components/zeby/TeethPanelFiltersBar";
import { TeethPanelKolejkaView } from "@/components/zeby/TeethPanelKolejkaView";
import { TeethPanelWeryfikacjaView } from "@/components/zeby/TeethPanelWeryfikacjaView";
import { TeethPanelHistoriaView } from "@/components/zeby/TeethPanelHistoriaView";
import { TeethPanelMarkOrderedDialog } from "@/components/zeby/TeethPanelMarkOrderedDialog";
import {
  TEETH_KOLEJKA_ICON_TILE,
  TEETH_WERYFIKACJA_ICON_TILE,
  TEETH_HISTORIA_ICON_TILE,
} from "@/lib/teeth/teeth-panel-shell";
import type { Tab } from "@/components/zeby/teeth-panel-types";
import { VALID_TEETH_PANEL_TABS } from "@/components/zeby/teeth-panel-types";
import {
  actionMarkTeethPositionsOrdered,
  actionMarkTeethScheduleOrdered,
  actionOverrideTeethDeliveryDate,
  actionFetchTeethHistoryGroups,
  actionFetchTeethQueue,
  actionFetchTeethVerificationQueue,
} from "@/app/actions/teeth-orders";
import {
  EMPTY_TEETH_PANEL_FILTERS,
  extractTeethFilterOptions,
  filterTeethQueueGroups,
  mergeTeethFilterOptions,
  type TeethPanelFilters,
} from "@/lib/teeth/teeth-panel-filters";
import {
  analyzeTeethMarkOrdered,
  type TeethMarkOrderedAnalysis,
} from "@/lib/teeth/teeth-mark-ordered";
import { teethPanelReadinessContextFromMaps } from "@/lib/teeth/teeth-panel-order-readiness";

const TEETH_TAB_PATHS: Record<Tab, string> = {
  kolejka: "/zeby/kolejka",
  weryfikacja: "/zeby/weryfikacja",
  historia: "/zeby/historia",
};

export function TeethPanelClient({
  initialGroups,
  activeTab: activeTabProp,
}: {
  initialGroups: TeethQueueGroup[];
  activeTab?: Tab;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const teethProductInfo = useTeethProductInfo();
  const readinessCtx = useMemo(
    () => teethPanelReadinessContextFromMaps(teethProductInfo),
    [teethProductInfo],
  );
  const tabParam = searchParams.get("tab");
  const tabFromQuery =
    tabParam && VALID_TEETH_PANEL_TABS.includes(tabParam as Tab) ? (tabParam as Tab) : null;
  const tab: Tab = activeTabProp ?? tabFromQuery ?? "kolejka";

  const [groups, setGroups] = useState(initialGroups);
  const [prevInitialGroups, setPrevInitialGroups] = useState(initialGroups);
  if (initialGroups !== prevInitialGroups) {
    setPrevInitialGroups(initialGroups);
    setGroups(initialGroups);
  }

  const reloadQueue = useCallback(async () => {
    try {
      if (tab === "weryfikacja") {
        const { groups: nextGroups } = await actionFetchTeethVerificationQueue();
        setGroups(nextGroups);
      } else {
        const { groups: nextGroups } = await actionFetchTeethQueue();
        setGroups(nextGroups);
      }
    } catch {
      router.refresh();
    }
  }, [router, tab]);

  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const [deliveryDateOpen, setDeliveryDateOpen] = useState(false);
  const [deliveryDateValue, setDeliveryDateValue] = useState("");
  const [filters, setFilters] = useState<TeethPanelFilters>(EMPTY_TEETH_PANEL_FILTERS);
  const [markConfirmOpen, setMarkConfirmOpen] = useState(false);
  const [markAnalysis, setMarkAnalysis] = useState<TeethMarkOrderedAnalysis | null>(null);
  const [markSelections, setMarkSelections] = useState<TeethPositionSelection[]>([]);
  const [markSupplierName, setMarkSupplierName] = useState<string | null>(null);
  const [historyGroupsForFilters, setHistoryGroupsForFilters] = useState<TeethQueueGroup[]>([]);

  const reloadHistoryFilterOptions = useCallback(() => {
    void actionFetchTeethHistoryGroups()
      .then(setHistoryGroupsForFilters)
      .catch(() => {
        /* filtry kolejki działają bez historii */
      });
  }, []);

  useEffect(() => {
    reloadHistoryFilterOptions();
  }, [reloadHistoryFilterOptions]);

  useEffect(() => {
    if (tab === "historia") reloadHistoryFilterOptions();
  }, [tab, reloadHistoryFilterOptions]);

  const displayFilters = useMemo(
    () =>
      tab === "historia"
        ? { ...filters, missingSpecOnly: false, verificationOnly: false }
        : filters,
    [tab, filters],
  );

  const filterOptions = useMemo(
    () =>
      mergeTeethFilterOptions(
        extractTeethFilterOptions(Array.isArray(groups) ? groups : []),
        extractTeethFilterOptions(
          Array.isArray(historyGroupsForFilters) ? historyGroupsForFilters : [],
        ),
      ),
    [groups, historyGroupsForFilters],
  );
  const filteredGroups = useMemo(
    () => filterTeethQueueGroups(groups, filters, readinessCtx),
    [groups, filters, readinessCtx],
  );
  const visibleOrderIds = useMemo(() => {
    const ids = new Set<string>();
    for (const group of filteredGroups) {
      for (const item of group.items) {
        if (!isScheduledItem(item)) ids.add(item.id);
      }
    }
    return ids;
  }, [filteredGroups]);

  const ordersById = useMemo(() => {
    const map = new Map<string, TeethQueueItem>();
    for (const group of groups) {
      for (const item of group.items) {
        if (!isScheduledItem(item)) {
          map.set(item.id, item);
        }
      }
    }
    return map;
  }, [groups]);

  const [positionSelectionRaw, setPositionSelection] = useState<Map<string, Set<number>>>(new Map());

  const positionSelection = useMemo(() => {
    const next = new Map<string, Set<number>>();
    for (const [orderId, positions] of positionSelectionRaw) {
      if (visibleOrderIds.has(orderId)) {
        const order = ordersById.get(orderId);
        if (order) {
          const validPositions = new Set<number>();
          const detailPositions = new Set((order.teeth_details ?? []).map((d) => d.position));
          for (const pos of positions) {
            if (detailPositions.has(pos)) validPositions.add(pos);
          }
          if (validPositions.size > 0) next.set(orderId, validPositions);
        }
      }
    }
    return next;
  }, [positionSelectionRaw, visibleOrderIds, ordersById]);

  const totalItems = useMemo(
    () => groups.reduce((sum, g) => sum + g.items.length, 0),
    [groups]
  );

  const togglePosition = useCallback((orderId: string, position: number) => {
    setPositionSelection((prev) => {
      const next = new Map(prev);
      const positions = next.get(orderId) ?? new Set<number>();
      const updated = new Set(positions);
      if (updated.has(position)) updated.delete(position);
      else updated.add(position);
      if (updated.size > 0) next.set(orderId, updated);
      else next.delete(orderId);
      return next;
    });
  }, []);

  const toggleSelectAllInGroup = useCallback((group: TeethQueueGroup) => {
    setPositionSelection((prev) => {
      const next = new Map(prev);
      const realItems = group.items.filter(
        (item): item is TeethQueueItem => !isScheduledItem(item),
      );
      const allUnorderedPositions: { orderId: string; positions: Set<number> }[] = [];
      for (const item of realItems) {
        const unordered = (item.teeth_details ?? [])
          .filter((d) => !d.ordered_at)
          .map((d) => d.position);
        if (unordered.length > 0) {
          allUnorderedPositions.push({ orderId: item.id, positions: new Set(unordered) });
        }
      }
      const allSelected = allUnorderedPositions.every(({ orderId, positions }) => {
        const sel = next.get(orderId);
        return sel && [...positions].every((p) => sel.has(p));
      });
      if (allSelected) {
        for (const { orderId, positions } of allUnorderedPositions) {
          const sel = next.get(orderId);
          if (sel) {
            const updated = new Set(sel);
            for (const p of positions) updated.delete(p);
            if (updated.size > 0) next.set(orderId, updated);
            else next.delete(orderId);
          }
        }
      } else {
        for (const { orderId, positions } of allUnorderedPositions) {
          next.set(orderId, new Set([...(next.get(orderId) ?? []), ...positions]));
        }
      }
      return next;
    });
  }, []);

  const requestMarkPositionsOrdered = useCallback(
    (selections: TeethPositionSelection[], supplierName?: string | null) => {
      if (selections.length === 0) return;
      const orderIds = selections.map((s) => s.orderId);
      const positionCount = selections.reduce((sum, s) => sum + s.positions.length, 0);
      const analysis = analyzeTeethMarkOrdered(orderIds, ordersById, readinessCtx);
      analysis.selectedPositionCount = positionCount;
      setMarkSelections(selections);
      setMarkAnalysis(analysis);
      setMarkSupplierName(supplierName ?? null);
      setMarkConfirmOpen(true);
    },
    [ordersById, readinessCtx],
  );

  const handleConfirmMarkOrdered = useCallback(async () => {
    setMarkConfirmOpen(false);
    const selections = markSelections.filter((s) => s.positions.length > 0);
    if (selections.length === 0) return;
    setPending(true);
    try {
      const result = await actionMarkTeethPositionsOrdered(selections);
      if (result.updated === 0) {
        setToast(TEETH_PANEL_TOAST.markFailed);
      } else {
        setToast(
          teethMarkOrderedToast({
            updated: result.updated,
            ordersCompleted: result.ordersCompleted,
            skipped: markAnalysis?.withoutSpecIds.length ?? 0,
            plPozycja,
          }),
        );
        setPositionSelection(new Map());
        reloadHistoryFilterOptions();
        void reloadQueue();
      }
      router.refresh();
    } catch (e) {
      setToast(toastFromError(e instanceof Error ? e.message : undefined, TEETH_PANEL_TOAST.markError.text));
    } finally {
      setPending(false);
      setMarkAnalysis(null);
      setMarkSelections([]);
      setMarkSupplierName(null);
    }
  }, [markSelections, markAnalysis, router, reloadHistoryFilterOptions, reloadQueue]);

  const handleSetDeliveryDate = useCallback(async () => {
    setDeliveryDateOpen(false);
    const selectedOrderIds = Array.from(positionSelection.keys());
    if (!deliveryDateValue || selectedOrderIds.length === 0) return;
    setPending(true);
    try {
      const result = await actionOverrideTeethDeliveryDate(selectedOrderIds, deliveryDateValue);
      setToast(TEETH_PANEL_TOAST.deliveryDateSet(result.updated, plPozycja));
      setPositionSelection(new Map());
      setDeliveryDateValue("");
      router.refresh();
    } catch (e) {
      setToast(toastFromError(e instanceof Error ? e.message : undefined, TEETH_PANEL_TOAST.deliveryDateSetFailed.text));
    } finally {
      setPending(false);
    }
  }, [deliveryDateValue, positionSelection, router]);

  const selectedPositionCount = useMemo(
    () => Array.from(positionSelection.values()).reduce((sum, positions) => sum + positions.size, 0),
    [positionSelection],
  );
  const selectedOrderCount = positionSelection.size;

  const handleMarkScheduleOrdered = useCallback(async (supplierId: string, supplierName: string) => {
    setPending(true);
    try {
      await actionMarkTeethScheduleOrdered(supplierId);
      setToast(TEETH_PANEL_TOAST.scheduleMarked(supplierName));
      router.refresh();
    } catch (e) {
      setToast(toastFromError(e instanceof Error ? e.message : undefined, TEETH_PANEL_TOAST.scheduleMarkFailed.text));
    } finally {
      setPending(false);
    }
  }, [router]);

  const navigateTab = useCallback(
    (id: Tab) => {
      router.push(TEETH_TAB_PATHS[id], { scroll: false });
    },
    [router],
  );

  return (
    <>
      <TeethPanelWorkspaceCard
        title={TEETH_TAB_PAGE_TITLES[tab]}
        hint={TEETH_TAB_HINTS[tab]}
        icon={
          tab === "historia" ? (
            <IconCircleCheck size={20} strokeWidth={1.75} />
          ) : (
            <IconTooth size={20} />
          )
        }
        iconTileClassName={
          tab === "kolejka" ? TEETH_KOLEJKA_ICON_TILE
          : tab === "weryfikacja" ? TEETH_WERYFIKACJA_ICON_TILE
          : tab === "historia" ? TEETH_HISTORIA_ICON_TILE
          : TEETH_KOLEJKA_ICON_TILE
        }
        beforeCard={
          toast ? (
            <NoticeToast notice={toast} onDismiss={() => setToast(null)} />
          ) : null
        }
      >
        <div className="md:hidden">
          <TeethPanelTabs
            active={tab}
            queueCount={totalItems}
            verificationCount={tab === "weryfikacja" ? totalItems : undefined}
            hint={TEETH_TAB_HINTS[tab]}
            onChange={navigateTab}
          />
        </div>

        {tab === "kolejka" ? (
          <TeethPanelTabPanel id="teeth-panel-view-kolejka" labelledBy="teeth-panel-tab-kolejka">
            <TeethPanelFiltersBar
              filters={filters}
              onChange={setFilters}
              suppliers={filterOptions.suppliers}
              salesPeople={filterOptions.salesPeople}
            />
            {groups.length === 0 ? (
              <TeethPanelEmpty
                title="Kolejka jest pusta"
                description="Gdy handlowiec złoży prośbę na zęby syntetyczne, pozycja pojawi się tutaj do zamówienia u dostawcy."
                icon={<IconTooth size={24} strokeWidth={1.75} />}
              />
            ) : (
              <TeethPanelKolejkaView
                groups={filteredGroups}
                readinessCtx={readinessCtx}
                positionSelection={positionSelection}
                pending={pending}
                selectedPositionCount={selectedPositionCount}
                selectedOrderCount={selectedOrderCount}
                onTogglePosition={togglePosition}
                onToggleSelectAllInGroup={toggleSelectAllInGroup}
                onRequestMarkPositionsOrdered={requestMarkPositionsOrdered}
                onSetDeliveryDate={() => setDeliveryDateOpen(true)}
                onMarkScheduleOrdered={handleMarkScheduleOrdered}
                onEditSaved={(message) => {
                  setToast(toastSuccess("Zapisano", message ?? "Lista zębów została zaktualizowana."));
                  void reloadQueue();
                }}
              />
            )}
          </TeethPanelTabPanel>
        ) : tab === "weryfikacja" ? (
          <TeethPanelTabPanel id="teeth-panel-view-weryfikacja" labelledBy="teeth-panel-tab-weryfikacja">
            <TeethPanelWeryfikacjaView
              groups={filteredGroups}
              pending={pending}
              onApproveDone={(message, tone) => {
                setToast(
                  tone === "error"
                    ? toastFromError(message)
                    : toastSuccess("Zapisano", message),
                );
                void reloadQueue();
              }}
              onEditSaved={(message) => {
                if (message) {
                  setToast(toastSuccess("Zapisano", message));
                }
                void reloadQueue();
              }}
            />
          </TeethPanelTabPanel>
        ) : (
          <TeethPanelTabPanel id="teeth-panel-view-historia" labelledBy="teeth-panel-tab-historia">
            <TeethPanelFiltersBar
              filters={displayFilters}
              onChange={setFilters}
              suppliers={filterOptions.suppliers}
              salesPeople={filterOptions.salesPeople}
              showQueueFilters={false}
            />
            <TeethPanelHistoriaView
              groups={null}
              readinessCtx={readinessCtx}
              filters={displayFilters}
              onToast={setToast}
              onReloadQueue={() => router.refresh()}
            />
          </TeethPanelTabPanel>
        )}
      </TeethPanelWorkspaceCard>

      <TeethPanelMarkOrderedDialog
        open={markConfirmOpen}
        analysis={markAnalysis}
        supplierName={markSupplierName}
        pending={pending}
        onConfirm={() => void handleConfirmMarkOrdered()}
        onCancel={() => {
          setMarkConfirmOpen(false);
          setMarkAnalysis(null);
          setMarkSelections([]);
          setMarkSupplierName(null);
        }}
      />

      {/* Modal ustawiania daty dostawy (kolejka) */}
      <ModalShell
        open={deliveryDateOpen}
        onClose={() => {
          setDeliveryDateOpen(false);
          setDeliveryDateValue("");
        }}
        title="Ustaw datę dostawy"
        description={`Podaj planowaną datę dostawy dla ${selectedOrderCount} ${plZaznaczonaPozycja(selectedOrderCount)}.`}
        size="sm"
        tier="raised"
        bodyClassName="px-5 py-4 sm:px-6"
        loadingMessage={pending ? "Zapisywanie…" : null}
        disableBackdropClose={pending}
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              className="min-h-11 w-full sm:w-auto"
              onClick={() => {
                setDeliveryDateOpen(false);
                setDeliveryDateValue("");
              }}
              disabled={pending}
            >
              Anuluj
            </Button>
            <Button
              className="min-h-11 w-full sm:w-auto"
              onClick={handleSetDeliveryDate}
              disabled={pending || !deliveryDateValue}
            >
              Zapisz
            </Button>
          </div>
        }
      >
        <Input
          type="date"
          value={deliveryDateValue}
          onChange={(e) => setDeliveryDateValue(e.target.value)}
          className="w-full"
        />
      </ModalShell>
    </>
  );
}
