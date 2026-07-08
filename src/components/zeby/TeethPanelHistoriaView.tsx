"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ModalShell } from "@/components/ui/ModalShell";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { TeethPanelEmpty, TeethPanelListSkeleton } from "@/components/zeby/TeethPanelSection";
import { TeethPanelHistoryOrderEntry } from "@/components/zeby/TeethPanelHistoryOrderEntry";
import type { TeethPanelReadinessContext } from "@/lib/teeth/teeth-panel-order-readiness";
import { TeethPanelSupplierGroupHeader } from "@/components/zeby/TeethPanelSupplierGroupHeader";
import {
  EMPTY_TEETH_PANEL_FILTERS,
  filterTeethHistoryGroups,
  countActiveTeethPanelFilters,
  type TeethPanelFilters,
} from "@/lib/teeth/teeth-panel-filters";
import { teethPanelHistoryOrdersListClass, teethPanelSupplierCardClass } from "@/lib/teeth/teeth-panel-ui";
import type { TeethQueueGroup, TeethQueueItem } from "@/lib/data/teeth-queue";
import {
  groupTeethItemsBySupplier,
  isScheduledItem,
  TEETH_HISTORY_PAGE_SIZE,
} from "@/lib/data/teeth-queue";
import {
  actionFetchTeethHistoryPage,
  actionOverrideTeethDeliveryDate,
  actionClearTeethDeliveryDateOverride,
  actionUnmarkTeethOrdered,
} from "@/app/actions/teeth-orders";
import { TeethPanelAuditLog } from "@/components/zeby/TeethPanelAuditLog";
import { IconCircleCheck } from "@/components/icons/StrokeIcons";
import {
  TEETH_PANEL_TOAST,
  toastFromError,
  type ToastNotice,
} from "@/lib/ui/notice-copy";

export function TeethPanelHistoriaView({
  groups,
  readinessCtx,
  filters = EMPTY_TEETH_PANEL_FILTERS,
  onToast,
  onReloadQueue,
}: {
  groups: TeethQueueGroup[] | null;
  readinessCtx?: TeethPanelReadinessContext;
  filters?: TeethPanelFilters;
  onToast: (toast: ToastNotice) => void;
  onReloadQueue?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(groups === null);
  const [historyGroups, setHistoryGroups] = useState<TeethQueueGroup[] | null>(groups);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [dateValue, setDateValue] = useState("");
  const [datePending, setDatePending] = useState(false);
  const [unmarkId, setUnmarkId] = useState<string | null>(null);
  const [unmarkPending, setUnmarkPending] = useState(false);

  const historyQuery = useCallback(
    () => ({
      supplierId: filters.supplierId,
      salesPersonId: filters.salesPersonId,
      limit: TEETH_HISTORY_PAGE_SIZE,
    }),
    [filters.supplierId, filters.salesPersonId]
  );

  const reloadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const page = await actionFetchTeethHistoryPage({
        ...historyQuery(),
        offset: 0,
      });
      setHistoryOffset(page.items.length);
      setHasMore(page.hasMore);
      setHistoryGroups(groupTeethItemsBySupplier(page.items));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd ładowania historii");
    } finally {
      setLoading(false);
    }
  }, [historyQuery]);

  const loadMoreHistory = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await actionFetchTeethHistoryPage({
        ...historyQuery(),
        offset: historyOffset,
      });
      const merged = [
        ...(historyGroups?.flatMap((g) =>
          g.items.filter((i): i is TeethQueueItem => !isScheduledItem(i))
        ) ?? []),
        ...page.items,
      ];
      setHistoryOffset(merged.length);
      setHasMore(page.hasMore);
      setHistoryGroups(groupTeethItemsBySupplier(merged));
    } catch (e) {
      onToast(toastFromError(e instanceof Error ? e.message : undefined, TEETH_PANEL_TOAST.historiaPageFailed.text));
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, historyQuery, historyOffset, historyGroups, onToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- przeładowanie przy zmianie filtrów
    void reloadHistory();
  }, [reloadHistory]);

  const openDateEditor = useCallback((item: TeethQueueItem) => {
    setEditingDateId(item.id);
    setDateValue(item.teeth_delivery_date ?? "");
  }, []);

  const handleSaveDate = useCallback(async () => {
    if (!editingDateId) return;
    setDatePending(true);
    try {
      if (dateValue) {
        await actionOverrideTeethDeliveryDate([editingDateId], dateValue);
        onToast(TEETH_PANEL_TOAST.historiaDeliveryDateSet);
      } else {
        await actionClearTeethDeliveryDateOverride([editingDateId]);
        onToast(TEETH_PANEL_TOAST.historiaDeliveryDateCleared);
      }
      setEditingDateId(null);
      setDateValue("");
      await reloadHistory();
    } catch (e) {
      onToast(toastFromError(e instanceof Error ? e.message : undefined, TEETH_PANEL_TOAST.historiaDateFailed.text));
    } finally {
      setDatePending(false);
    }
  }, [editingDateId, dateValue, reloadHistory, onToast]);

  const handleClearDate = useCallback(async () => {
    if (!editingDateId) return;
    setDatePending(true);
    try {
      await actionClearTeethDeliveryDateOverride([editingDateId]);
      onToast({ message: "Wyczyszczono datę dostawy", tone: "success" });
      setEditingDateId(null);
      setDateValue("");
      await reloadHistory();
    } catch (e) {
      onToast(toastFromError(e instanceof Error ? e.message : undefined, TEETH_PANEL_TOAST.historiaDateClearFailed.text));
    } finally {
      setDatePending(false);
    }
  }, [editingDateId, reloadHistory, onToast]);

  const handleUnmark = useCallback(async () => {
    if (!unmarkId) return;
    setUnmarkPending(true);
    try {
      const result = await actionUnmarkTeethOrdered([unmarkId]);
      if (result.updated === 0) {
        onToast(TEETH_PANEL_TOAST.unmarkFailed);
      } else {
        onToast(TEETH_PANEL_TOAST.unmarkSuccess);
        onReloadQueue?.();
        await reloadHistory();
      }
      setUnmarkId(null);
    } catch (e) {
      onToast(toastFromError(e instanceof Error ? e.message : undefined, TEETH_PANEL_TOAST.unmarkError.text));
    } finally {
      setUnmarkPending(false);
    }
  }, [unmarkId, onToast, onReloadQueue, reloadHistory]);

  if (error) {
    return (
      <TeethPanelEmpty
        title="Nie udało się wczytać historii"
        description={error}
        tone="sky"
        icon={<IconCircleCheck size={24} strokeWidth={1.75} />}
      />
    );
  }

  if (loading || historyGroups === null) {
    return <TeethPanelListSkeleton />;
  }

  if (historyGroups.length === 0) {
    return (
      <TeethPanelEmpty
        title={
          countActiveTeethPanelFilters(filters) > 0
            ? "Brak pozycji spełniających filtry"
            : "Brak zamówionych pozycji"
        }
        description={
          countActiveTeethPanelFilters(filters) > 0
            ? "Zmień filtry, aby zobaczyć historię zamówień zębów."
            : "Po oznaczeniu pozycji w kolejce jako zamówione u dostawcy trafią tutaj wraz z planowaną datą dostawy."
        }
        tone="sky"
        icon={<IconCircleCheck size={24} strokeWidth={1.75} />}
      />
    );
  }

  const displayGroups = filterTeethHistoryGroups(historyGroups, filters, readinessCtx);
  if (displayGroups.length === 0) {
    return (
      <TeethPanelEmpty
        title="Brak pozycji spełniających filtry"
        description="Zmień filtry historii zamówień zębów."
        tone="sky"
        icon={<IconCircleCheck size={24} strokeWidth={1.75} />}
      />
    );
  }

  return (
    <>
      <div className="space-y-3">
        {displayGroups.map((group) => {
        const items = group.items.filter(
          (i): i is TeethQueueItem => !isScheduledItem(i),
        );

        return (
          <div key={group.supplierId ?? "__no_supplier"} className={teethPanelSupplierCardClass}>
            <TeethPanelSupplierGroupHeader
              group={group}
              orderCount={items.length}
              hideProductLines
            />

            <div className={teethPanelHistoryOrdersListClass}>
              {items.map((item) => (
                <TeethPanelHistoryOrderEntry
                  key={item.id}
                  item={item}
                  onEditDate={() => openDateEditor(item)}
                  onUnmark={
                    item.status === "Zamowione" ? () => setUnmarkId(item.id) : undefined
                  }
                />
              ))}
            </div>
          </div>
        );
      })}
      </div>

      {hasMore ? (
        <div className="flex justify-center px-3 pb-2 pt-1">
          <Button
            variant="ghost"
            className="min-h-10"
            disabled={loadingMore}
            onClick={() => void loadMoreHistory()}
          >
            {loadingMore ? "Wczytywanie…" : "Pokaż starsze zamówienia"}
          </Button>
        </div>
      ) : null}

      <TeethPanelAuditLog supplierId={filters.supplierId} className="mt-3" />

      <ConfirmDialog
        open={unmarkId !== null}
        title="Cofnij zamówienie u dostawcy"
        message="Pozycja wróci do kolejki ze statusem „Nowe”. Użyj tego, gdy zamówienie u dostawcy nie zostało jeszcze złożone lub wymaga poprawki."
        confirmLabel="Cofnij do kolejki"
        cancelLabel="Anuluj"
        danger
        pending={unmarkPending}
        onConfirm={() => void handleUnmark()}
        onCancel={() => setUnmarkId(null)}
      />

      <ModalShell
        open={editingDateId !== null}
        onClose={() => {
          setEditingDateId(null);
          setDateValue("");
        }}
        title="Zmień datę dostawy"
        description='Podaj planowaną datę dostawy. Aby wrócić do automatycznego szacunku, kliknij „Wyczyść”.'
        size="sm"
        tier="raised"
        bodyClassName="px-5 py-4 sm:px-6"
        loadingMessage={datePending ? "Zapisywanie…" : null}
        disableBackdropClose={datePending}
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              className="min-h-11 w-full sm:w-auto"
              onClick={() => {
                setEditingDateId(null);
                setDateValue("");
              }}
              disabled={datePending}
            >
              Anuluj
            </Button>
            {dateValue ? (
              <Button
                variant="ghost"
                className="min-h-11 w-full text-red-600 hover:text-red-700 sm:w-auto"
                onClick={() => void handleClearDate()}
                disabled={datePending}
              >
                Wyczyść
              </Button>
            ) : null}
            <Button
              className="min-h-11 w-full sm:w-auto"
              onClick={() => void handleSaveDate()}
              disabled={datePending}
            >
              Zapisz
            </Button>
          </div>
        }
      >
        <Input
          type="date"
          value={dateValue}
          onChange={(e) => setDateValue(e.target.value)}
          className="w-full"
        />
      </ModalShell>
    </>
  );
}
