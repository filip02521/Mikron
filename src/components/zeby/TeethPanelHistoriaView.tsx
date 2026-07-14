"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ModalShell } from "@/components/ui/ModalShell";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { checkboxBrandClass } from "@/lib/ui/ontime-theme";
import Link from "next/link";
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
import { IconCircleCheck, IconAlertCircle, IconSearch } from "@/components/icons/StrokeIcons";
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
  const [searchSpec, setSearchSpec] = useState("");
  const [bulkDateMode, setBulkDateMode] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDateValue, setBulkDateValue] = useState("");
  const [bulkDatePending, setBulkDatePending] = useState(false);

  const historyQuery = useCallback(
    () => ({
      limit: TEETH_HISTORY_PAGE_SIZE,
    }),
    []
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
      onToast(TEETH_PANEL_TOAST.historiaDeliveryDateCleared);
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

  const toggleBulkSelect = useCallback((orderId: string) => {
    setBulkSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }, []);

  const handleBulkSaveDate = useCallback(async () => {
    if (bulkSelectedIds.size === 0 || !bulkDateValue) return;
    setBulkDatePending(true);
    try {
      await actionOverrideTeethDeliveryDate(Array.from(bulkSelectedIds), bulkDateValue);
      onToast(TEETH_PANEL_TOAST.historiaDeliveryDateSet);
      setBulkDateMode(false);
      setBulkSelectedIds(new Set());
      setBulkDateValue("");
      await reloadHistory();
    } catch (e) {
      onToast(toastFromError(e instanceof Error ? e.message : undefined, TEETH_PANEL_TOAST.historiaDateFailed.text));
    } finally {
      setBulkDatePending(false);
    }
  }, [bulkSelectedIds, bulkDateValue, reloadHistory, onToast]);

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
        action={
          countActiveTeethPanelFilters(filters) === 0 ? (
            <Link
              href="/zeby/kolejka"
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              Przejdź do kolejki
            </Link>
          ) : null
        }
      />
    );
  }

  const displayGroups = filterTeethHistoryGroups(historyGroups, filters, readinessCtx, searchSpec);

  const delayedItems = displayGroups
    .flatMap((g) => g.items.filter((i): i is TeethQueueItem => !isScheduledItem(i)))
    .filter((item) => {
      if (item.status === "Zrealizowane" || item.status === "Anulowane") return false;
      if (!item.teeth_delivery_date) return false;
      const today = new Date().toISOString().slice(0, 10);
      return item.teeth_delivery_date < today;
    });

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
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <IconSearch size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchSpec}
            onChange={(e) => setSearchSpec(e.target.value)}
            placeholder="Szukaj po kolorze, fasonie, produkcie, handlowcu…"
            className="w-full rounded-md border border-slate-200/80 bg-white py-1.5 pl-8 pr-3 text-sm text-slate-700 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400"
            aria-label="Szukaj w historii zamówień"
          />
        </div>
        <Button
          variant={bulkDateMode ? "primary" : "secondary"}
          size="sm"
          onClick={() => {
            setBulkDateMode((v) => !v);
            setBulkSelectedIds(new Set());
          }}
        >
          {bulkDateMode ? "Anuluj" : "Zmień datę (grupowo)"}
        </Button>
      </div>
      {bulkDateMode ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-indigo-200/80 bg-indigo-50/80 px-3 py-2">
          <span className="text-sm font-medium text-indigo-700">
            Zaznaczono: {bulkSelectedIds.size}
          </span>
          <Input
            type="date"
            value={bulkDateValue}
            onChange={(e) => setBulkDateValue(e.target.value)}
            className="w-auto"
            aria-label="Data dostawy dla zaznaczonych"
          />
          <Button
            size="sm"
            disabled={bulkSelectedIds.size === 0 || !bulkDateValue || bulkDatePending}
            onClick={() => void handleBulkSaveDate()}
          >
            {bulkDatePending ? <Spinner size="sm" /> : null}
            Zapisz datę
          </Button>
        </div>
      ) : null}
      {delayedItems.length > 0 ? (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-sm text-amber-800">
          <IconAlertCircle size={18} className="shrink-0 text-amber-600" />
          <span>
            <strong>{delayedItems.length}</strong>{" "}
            {delayedItems.length === 1 ? "opóźniona dostawa" : delayedItems.length < 5 ? "opóźnione dostawy" : "opóźnionych dostaw"}{" "}
            — sprawdź daty poniżej
          </span>
        </div>
      ) : null}
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
                <div key={item.id} className="flex items-start gap-2">
                  {bulkDateMode ? (
                    <input
                      type="checkbox"
                      checked={bulkSelectedIds.has(item.id)}
                      onChange={() => toggleBulkSelect(item.id)}
                      className={cn("mt-1 size-4 shrink-0", checkboxBrandClass)}
                      aria-label={`Zaznacz ${item.products}`}
                    />
                  ) : null}
                  <TeethPanelHistoryOrderEntry
                    item={item}
                    onEditDate={bulkDateMode ? undefined : () => openDateEditor(item)}
                    onUnmark={
                      bulkDateMode
                        ? undefined
                        : item.status === "Zamowione" ? () => setUnmarkId(item.id) : undefined
                    }
                  />
                </div>
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
            {loadingMore ? <Spinner size="sm" /> : null}
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
