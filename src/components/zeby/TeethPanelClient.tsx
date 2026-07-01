"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTeethProductInfo } from "@/components/layout/TeethExemptContext";
import { plPozycja, plZaznaczonaPozycja } from "@/lib/ui/polish-plurals";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { Toast } from "@/components/ui/Toast";
import { Input } from "@/components/ui/Field";
import { IconTooth, IconCircleCheck } from "@/components/icons/StrokeIcons";
import type { TeethQueueGroup, TeethQueueItem } from "@/lib/data/teeth-queue";
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
import { TeethPanelHistoriaView } from "@/components/zeby/TeethPanelHistoriaView";
import { TeethPanelMarkOrderedDialog } from "@/components/zeby/TeethPanelMarkOrderedDialog";
import {
  TEETH_HISTORIA_ICON_TILE,
  TEETH_PANEL_ICON_TILE,
} from "@/lib/teeth/teeth-panel-shell";
import type { Tab } from "@/components/zeby/teeth-panel-types";
import { VALID_TEETH_PANEL_TABS } from "@/components/zeby/teeth-panel-types";
import {
  actionMarkTeethOrdered,
  actionMarkTeethScheduleOrdered,
  actionOverrideTeethDeliveryDate,
  actionFetchTeethHistoryGroups,
  actionFetchTeethQueue,
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
      const { groups: nextGroups } = await actionFetchTeethQueue();
      setGroups(nextGroups);
    } catch {
      router.refresh();
    }
  }, [router]);

  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [deliveryDateOpen, setDeliveryDateOpen] = useState(false);
  const [deliveryDateValue, setDeliveryDateValue] = useState("");
  const [filters, setFilters] = useState<TeethPanelFilters>(EMPTY_TEETH_PANEL_FILTERS);
  const [markConfirmOpen, setMarkConfirmOpen] = useState(false);
  const [markAnalysis, setMarkAnalysis] = useState<TeethMarkOrderedAnalysis | null>(null);
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

  const [selectedIdsRaw, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedIds = useMemo(() => {
    const next = new Set<string>();
    for (const id of selectedIdsRaw) {
      if (visibleOrderIds.has(id)) next.add(id);
    }
    return next;
  }, [selectedIdsRaw, visibleOrderIds]);

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

  const totalItems = useMemo(
    () => groups.reduce((sum, g) => sum + g.items.length, 0),
    [groups]
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAllInGroup = useCallback((group: TeethQueueGroup) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const realItems = group.items.filter((item) => !isScheduledItem(item));
      const allSelected = realItems.every((item) => next.has(item.id));
      if (allSelected) {
        realItems.forEach((item) => next.delete(item.id));
      } else {
        realItems.forEach((item) => next.add(item.id));
      }
      return next;
    });
  }, []);

  const requestMarkOrdered = useCallback(
    (orderIds: string[], supplierName?: string | null) => {
      const unique = [...new Set(orderIds)].filter((id) => ordersById.has(id));
      if (unique.length === 0) return;
      const analysis = analyzeTeethMarkOrdered(unique, ordersById, readinessCtx);
      setMarkAnalysis(analysis);
      setMarkSupplierName(supplierName ?? null);
      setMarkConfirmOpen(true);
    },
    [ordersById, readinessCtx],
  );

  const handleConfirmMarkOrdered = useCallback(async () => {
    setMarkConfirmOpen(false);
    const idsToMark = markAnalysis?.withSpecIds ?? [];
    if (idsToMark.length === 0) return;
    setPending(true);
    try {
      const result = await actionMarkTeethOrdered(idsToMark);
      if (result.updated === 0) {
        setToast({
          message: "Nie udało się oznaczyć pozycji — być może zostały już zamówione.",
          tone: "error",
        });
      } else {
        const skipped = (markAnalysis?.withoutSpecIds.length ?? 0);
        setToast({
          message:
            skipped > 0
              ? `Oznaczono ${result.updated} ${plPozycja(result.updated)} — ${skipped} pominięto (niekompletna lista zębów).`
              : result.updated === 1
                ? "1 pozycja oznaczona jako zamówiona"
                : `${result.updated} ${plPozycja(result.updated)} oznaczonych jako zamówione`,
          tone: "success",
        });
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (const id of idsToMark) next.delete(id);
          return next;
        });
        reloadHistoryFilterOptions();
      }
      router.refresh();
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : "Błąd oznaczania zamówionych",
        tone: "error",
      });
    } finally {
      setPending(false);
      setMarkAnalysis(null);
      setMarkSupplierName(null);
    }
  }, [markAnalysis, router, reloadHistoryFilterOptions]);

  const handleSetDeliveryDate = useCallback(async () => {
    setDeliveryDateOpen(false);
    if (!deliveryDateValue || selectedIds.size === 0) return;
    setPending(true);
    try {
      const ids = Array.from(selectedIds);
      const result = await actionOverrideTeethDeliveryDate(ids, deliveryDateValue);
      setToast({
        message:
          result.updated === 1
            ? "Ustawiono datę dostawy dla 1 pozycji"
            : `Ustawiono datę dostawy dla ${result.updated} ${plPozycja(result.updated)}`,
        tone: "success",
      });
      setSelectedIds(new Set());
      setDeliveryDateValue("");
      router.refresh();
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : "Błąd ustawiania daty dostawy",
        tone: "error",
      });
    } finally {
      setPending(false);
    }
  }, [deliveryDateValue, selectedIds, router]);

  const selectedCount = selectedIds.size;

  const handleMarkScheduleOrdered = useCallback(async (supplierId: string, supplierName: string) => {
    setPending(true);
    try {
      await actionMarkTeethScheduleOrdered(supplierId);
      setToast({
        message: `Oznaczono jako zamówione u dostawcy ${supplierName} — harmonogram przesunięty na następny termin`,
        tone: "success",
      });
      router.refresh();
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : "Błąd oznaczania zamówienia",
        tone: "error",
      });
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
        iconTileClassName={tab === "historia" ? TEETH_HISTORIA_ICON_TILE : TEETH_PANEL_ICON_TILE}
        beforeCard={
          toast ? (
            <Toast
              message={toast.message}
              tone={toast.tone}
              onDismiss={() => setToast(null)}
            />
          ) : null
        }
      >
        <div className="md:hidden">
          <TeethPanelTabs
            active={tab}
            queueCount={totalItems}
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
                selectedIds={selectedIds}
                pending={pending}
                selectedCount={selectedCount}
                onToggleSelect={toggleSelect}
                onToggleSelectAllInGroup={toggleSelectAllInGroup}
                onRequestMarkOrdered={requestMarkOrdered}
                onSetDeliveryDate={() => setDeliveryDateOpen(true)}
                onMarkScheduleOrdered={handleMarkScheduleOrdered}
                onEditSaved={(message) => {
                  setToast({
                    message: message ?? "Zapisano listę zębów.",
                    tone: "success",
                  });
                  void reloadQueue();
                }}
              />
            )}
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
        description={`Podaj planowaną datę dostawy dla ${selectedCount} ${plZaznaczonaPozycja(selectedCount)}.`}
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
