"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTeethProductInfo } from "@/components/layout/TeethExemptContext";
import { panelWorkspaceShellClass } from "@/lib/ui/ontime-theme";
import { plPozycja, plZaznaczonaPozycja } from "@/lib/ui/polish-plurals";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { Toast } from "@/components/ui/Toast";
import { Input } from "@/components/ui/Field";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { IconPackage } from "@/components/icons/StrokeIcons";
import type { TeethQueueGroup, TeethQueueItem } from "@/lib/data/teeth-queue";
import { isScheduledItem } from "@/lib/data/teeth-queue";
import { TeethPanelTabs } from "@/components/zeby/TeethPanelTabs";
import {
  TEETH_PANEL_HINT,
  TEETH_PANEL_TITLE,
  TEETH_TAB_HINTS,
} from "@/components/zeby/teeth-panel-copy";
import { TeethPanelEmpty, TeethPanelTabPanel } from "@/components/zeby/TeethPanelSection";
import { TeethPanelFiltersBar } from "@/components/zeby/TeethPanelFiltersBar";
import { TeethPanelKolejkaView } from "@/components/zeby/TeethPanelKolejkaView";
import { TeethPanelHistoriaView } from "@/components/zeby/TeethPanelHistoriaView";
import { TeethPanelHarmonogramView } from "@/components/zeby/TeethPanelHarmonogramView";
import { TeethPanelMarkOrderedDialog } from "@/components/zeby/TeethPanelMarkOrderedDialog";
import { TeethPanelContentFooter } from "@/components/zeby/TeethPanelContentFooter";
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
  teethQueueStatsBySupplier,
  type TeethPanelFilters,
} from "@/lib/teeth/teeth-panel-filters";
import {
  analyzeTeethMarkOrdered,
  type TeethMarkOrderedAnalysis,
} from "@/lib/teeth/teeth-mark-ordered";
import { teethPanelReadinessContextFromMaps } from "@/lib/teeth/teeth-panel-order-readiness";

const TEETH_ICON_TILE =
  "bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-[var(--shadow-brand)] ring-1 ring-emerald-500/30";

export function TeethPanelClient({
  initialGroups,
}: {
  initialGroups: TeethQueueGroup[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const teethProductInfo = useTeethProductInfo();
  const readinessCtx = useMemo(
    () => teethPanelReadinessContextFromMaps(teethProductInfo),
    [teethProductInfo],
  );
  const tabParam = searchParams.get("tab");
  const tab: Tab =
    tabParam && VALID_TEETH_PANEL_TABS.includes(tabParam as Tab) ? (tabParam as Tab) : "kolejka";

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
  const [pendingMarkIds, setPendingMarkIds] = useState<string[]>([]);
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

  const queueStatsBySupplier = useMemo(
    () => teethQueueStatsBySupplier(groups, readinessCtx),
    [groups, readinessCtx],
  );

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
      setPendingMarkIds(unique);
      setMarkAnalysis(analysis);
      setMarkSupplierName(supplierName ?? null);
      setMarkConfirmOpen(true);
    },
    [ordersById, readinessCtx],
  );

  const handleConfirmMarkOrdered = useCallback(async () => {
    setMarkConfirmOpen(false);
    if (pendingMarkIds.length === 0) return;
    setPending(true);
    try {
      const result = await actionMarkTeethOrdered(pendingMarkIds);
      if (result.updated === 0) {
        setToast({
          message: "Nie udało się oznaczyć pozycji — być może zostały już zamówione.",
          tone: "error",
        });
      } else {
        setToast({
          message:
            result.updated === 1
              ? "1 pozycja oznaczona jako zamówiona"
              : `${result.updated} ${plPozycja(result.updated)} oznaczonych jako zamówione`,
          tone: "success",
        });
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (const id of pendingMarkIds) next.delete(id);
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
      setPendingMarkIds([]);
      setMarkAnalysis(null);
      setMarkSupplierName(null);
    }
  }, [pendingMarkIds, router, reloadHistoryFilterOptions]);

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
      const params = new URLSearchParams(searchParams.toString());
      if (id === "kolejka") {
        params.delete("tab");
      } else {
        params.set("tab", id);
      }
      const qs = params.toString();
      router.replace(qs ? `/zeby?${qs}` : "/zeby", { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <div className={panelWorkspaceShellClass}>
      <Card padding={false} className="overflow-x-clip">
        <CardHeader
          inset
          density="compact"
          leading={
            <SectionHeadingIcon tileClassName={TEETH_ICON_TILE}>
              <IconPackage size={20} />
            </SectionHeadingIcon>
          }
          title={TEETH_PANEL_TITLE}
          hint={TEETH_PANEL_HINT}
          hintAriaLabel="Informacja o panelu zębów"
        />

        <TeethPanelTabs
          active={tab}
          queueCount={totalItems}
          hint={TEETH_TAB_HINTS[tab]}
          onChange={navigateTab}
        />

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
                icon={<IconPackage size={24} strokeWidth={1.75} />}
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
        ) : tab === "historia" ? (
          <TeethPanelTabPanel id="teeth-panel-view-historia" labelledBy="teeth-panel-tab-historia">
            <TeethPanelFiltersBar
              filters={filters}
              onChange={setFilters}
              suppliers={filterOptions.suppliers}
              salesPeople={filterOptions.salesPeople}
            />
            <TeethPanelHistoriaView
              groups={null}
              readinessCtx={readinessCtx}
              filters={filters}
              onToast={setToast}
              onReloadQueue={() => router.refresh()}
            />
          </TeethPanelTabPanel>
        ) : (
          <TeethPanelTabPanel id="teeth-panel-view-harmonogram" labelledBy="teeth-panel-tab-harmonogram">
            <TeethPanelHarmonogramView onToast={setToast} queueStatsBySupplier={queueStatsBySupplier} />
          </TeethPanelTabPanel>
        )}
        <TeethPanelContentFooter />
      </Card>

      <TeethPanelMarkOrderedDialog
        open={markConfirmOpen}
        analysis={markAnalysis}
        supplierName={markSupplierName}
        pending={pending}
        onConfirm={() => void handleConfirmMarkOrdered()}
        onCancel={() => {
          setMarkConfirmOpen(false);
          setPendingMarkIds([]);
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

      {/* Toast */}
      {toast ? (
        <Toast
          message={toast.message}
          tone={toast.tone}
          onDismiss={() => setToast(null)}
        />
      ) : null}
    </div>
  );
}
