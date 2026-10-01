"use client";

import { useCallback, useEffect, useState } from "react";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ModalShell } from "@/components/ui/ModalShell";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import Link from "next/link";
import { TeethPanelEmpty, TeethPanelListSkeleton } from "@/components/zeby/TeethPanelSection";
import {
  TeethPanelHistoryOrderEntry,
  teethHistoryState,
  type TeethHistoryState,
} from "@/components/zeby/TeethPanelHistoryOrderEntry";
import { polishPluralWord } from "@/lib/email/polish-plural";
import type { TeethPanelReadinessContext } from "@/lib/teeth/teeth-panel-order-readiness";
import {
  EMPTY_TEETH_PANEL_FILTERS,
  filterTeethHistoryGroups,
  countActiveTeethPanelFilters,
  type TeethPanelFilters,
} from "@/lib/teeth/teeth-panel-filters";
import type { TeethQueueGroup, TeethQueueItem } from "@/lib/data/teeth-queue-shared";
import {
  groupTeethItemsBySupplier,
  isScheduledItem,
  TEETH_HISTORY_PAGE_SIZE,
} from "@/lib/data/teeth-queue-shared";
import { formatDateString } from "@/lib/orders/dates";
import { todayInWarsaw } from "@/lib/time/warsaw";
import {
  actionFetchTeethHistoryPage,
  actionOverrideTeethDeliveryDate,
  actionClearTeethDeliveryDateOverride,
  actionUnmarkTeethOrdered,
} from "@/app/actions/teeth-orders";
import { TeethPanelAuditLog } from "@/components/zeby/TeethPanelAuditLog";
import { IconCircleCheck, IconAlertCircle, IconSearch, IconCalendar } from "@/components/icons/StrokeIcons";
import { TEETH_PANEL_TOAST, type ToastNotice, toastFromUnknown } from "@/lib/ui/notice-copy";

const plZamowienie = (n: number) => polishPluralWord(n, "zamówienie", "zamówienia", "zamówień");

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
      setError(userFacingErrorText(e, "Błąd ładowania historii"));
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
      onToast(toastFromUnknown(e, TEETH_PANEL_TOAST.historiaPageFailed.text));
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
      onToast(toastFromUnknown(e, TEETH_PANEL_TOAST.historiaDateFailed.text));
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
      onToast(toastFromUnknown(e, TEETH_PANEL_TOAST.historiaDateClearFailed.text));
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
      onToast(toastFromUnknown(e, TEETH_PANEL_TOAST.unmarkError.text));
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
      onToast(toastFromUnknown(e, TEETH_PANEL_TOAST.historiaDateFailed.text));
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
      const today = formatDateString(todayInWarsaw());
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

  const allHistoryItems = displayGroups.flatMap((g) =>
    g.items.filter((i): i is TeethQueueItem => !isScheduledItem(i)),
  );
  const countByState = (state: TeethHistoryState) =>
    allHistoryItems.filter((i) => teethHistoryState(i) === state).length;

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchSpec}
            onChange={(e) => setSearchSpec(e.target.value)}
            placeholder="Szukaj: kolor, fason, produkt, handlowiec…"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/30"
            aria-label="Szukaj w historii zamówień"
          />
        </div>
        <Button
          variant={bulkDateMode ? "primary" : "secondary"}
          className="min-h-10"
          onClick={() => {
            setBulkDateMode((v) => !v);
            setBulkSelectedIds(new Set());
          }}
        >
          <IconCalendar size={15} />
          {bulkDateMode ? "Zakończ zaznaczanie" : "Zmień datę kilku"}
        </Button>
      </div>

      {bulkDateMode ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-3">
          <span className="text-sm font-medium text-indigo-900">
            Zaznacz zamówienia poniżej · wybrano {bulkSelectedIds.size}
          </span>
          <Input
            type="date"
            value={bulkDateValue}
            onChange={(e) => setBulkDateValue(e.target.value)}
            className="w-auto sm:ml-auto"
            aria-label="Nowa data dostawy dla zaznaczonych"
          />
          <Button
            size="sm"
            className="min-h-9"
            disabled={bulkSelectedIds.size === 0 || !bulkDateValue || bulkDatePending}
            onClick={() => void handleBulkSaveDate()}
          >
            {bulkDatePending ? <Spinner size="sm" /> : null}
            Ustaw datę
          </Button>
        </div>
      ) : null}

      {delayedItems.length > 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50/70 px-4 py-3 text-sm text-red-800">
          <IconAlertCircle size={18} className="shrink-0 text-red-600" />
          <span>
            <strong>{delayedItems.length}</strong> {plZamowienie(delayedItems.length)} po terminie
            dostawy — skontaktuj się z dostawcą albo popraw datę.
          </span>
        </div>
      ) : null}

      <p className="text-xs text-slate-500">
        W drodze: <strong className="text-slate-700">{countByState("in_transit")}</strong>
        {" · "}Opóźnione: <strong className="text-slate-700">{countByState("late")}</strong>
        {" · "}Częściowo: <strong className="text-slate-700">{countByState("partial")}</strong>
        {" · "}Dostarczone: <strong className="text-slate-700">{countByState("done")}</strong>
      </p>

      {displayGroups.map((group) => {
        const items = group.items.filter((i): i is TeethQueueItem => !isScheduledItem(i));
        return (
          <section
            key={group.supplierId ?? "__no_supplier"}
            aria-label={`Dostawca ${group.supplierName}`}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
              <h2 className="text-base font-semibold text-slate-900">{group.supplierName}</h2>
              <span className="text-xs text-slate-500">
                {items.length} {plZamowienie(items.length)}
              </span>
            </header>
            <ul className="divide-y divide-slate-100">
              {items.map((item) => (
                <TeethPanelHistoryOrderEntry
                  key={item.id}
                  item={item}
                  selectable={bulkDateMode}
                  selected={bulkSelectedIds.has(item.id)}
                  onToggleSelected={() => toggleBulkSelect(item.id)}
                  onEditDate={
                    bulkDateMode || item.status === "Zrealizowane" || item.status === "Anulowane"
                      ? undefined
                      : () => openDateEditor(item)
                  }
                  onUnmark={
                    !bulkDateMode && item.status === "Zamowione"
                      ? () => setUnmarkId(item.id)
                      : undefined
                  }
                />
              ))}
            </ul>
          </section>
        );
      })}

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
