"use client";

import { groupTeethQueueByProductLine } from "@/lib/teeth/teeth-queue-view-model";
import {
  TeethProductLineChips,
  TeethProductLineSectionHeader,
  teethLineSectionDomId,
} from "@/components/zeby/TeethProductLineSectionHeader";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
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
  TEETH_HISTORY_STATE_META,
  teethHistoryState,
  type TeethHistoryState,
} from "@/components/zeby/TeethPanelHistoryOrderEntry";
import { IconChevronDown } from "@/components/icons/StrokeIcons";
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

const SUMMARY_STATES: TeethHistoryState[] = ["late", "partial", "in_transit", "done", "cancelled"];

function historyStateCounts(items: TeethQueueItem[]): Map<TeethHistoryState, number> {
  const counts = new Map<TeethHistoryState, number>();
  for (const item of items) {
    const state = teethHistoryState(item);
    counts.set(state, (counts.get(state) ?? 0) + 1);
  }
  return counts;
}

/** Zwięzłe podsumowanie stanów — widoczne także gdy lista jest zwinięta. */
function HistoryStateSummary({ items }: { items: TeethQueueItem[] }) {
  const counts = historyStateCounts(items);
  return (
    <span className="flex flex-wrap items-center gap-1">
      {SUMMARY_STATES.filter((state) => (counts.get(state) ?? 0) > 0).map((state) => (
        <span
          key={state}
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ring-1 ring-inset",
            TEETH_HISTORY_STATE_META[state].badge,
          )}
        >
          {TEETH_HISTORY_STATE_META[state].label} {counts.get(state)}
        </span>
      ))}
    </span>
  );
}

/** Lista „aktywna” (coś jeszcze w drodze / opóźnione / częściowo) — domyślnie rozwinięta. */
function hasActiveHistoryItems(items: TeethQueueItem[]): boolean {
  return items.some((item) => {
    const state = teethHistoryState(item);
    return state === "late" || state === "partial" || state === "in_transit";
  });
}

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
  /** Ręcznie rozwinięte/zwinięte listy (dostawca / linia); reszta wg domyślnej reguły. */
  const [expandOverrides, setExpandOverrides] = useState<Map<string, boolean>>(new Map());

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

  // Szukanie, zaznaczanie kilku dat lub jeden dostawca — wszystko rozwinięte, żeby nic nie umknęło.
  const forceOpen = searchSpec.trim() !== "" || bulkDateMode || displayGroups.length === 1;
  const hasLateItems = (items: TeethQueueItem[]) =>
    items.some((item) => teethHistoryState(item) === "late");
  const isExpanded = (key: string, fallback: boolean) => expandOverrides.get(key) ?? fallback;
  const setExpanded = (key: string, open: boolean) =>
    setExpandOverrides((prev) => new Map(prev).set(key, open));
  const setAllExpanded = (open: boolean) => {
    const next = new Map<string, boolean>();
    for (const group of displayGroups) {
      const items = group.items.filter((i): i is TeethQueueItem => !isScheduledItem(i));
      const supplierKey = `s:${group.supplierId ?? "__no_supplier"}`;
      next.set(supplierKey, open);
      for (const section of groupTeethQueueByProductLine(items, readinessCtx)) {
        next.set(`${supplierKey}|${section.key}`, open);
      }
    }
    setExpandOverrides(next);
  };

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

      <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-slate-500">
        W drodze: <strong className="text-slate-700">{countByState("in_transit")}</strong>
        {" · "}Opóźnione: <strong className="text-slate-700">{countByState("late")}</strong>
        {" · "}Częściowo: <strong className="text-slate-700">{countByState("partial")}</strong>
        {" · "}Dostarczone: <strong className="text-slate-700">{countByState("done")}</strong>
      </p>
        <div className="flex items-center gap-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setAllExpanded(true)}
            className="rounded-md px-2 py-1 text-indigo-700 hover:bg-indigo-50"
          >
            Rozwiń wszystko
          </button>
          <button
            type="button"
            onClick={() => setAllExpanded(false)}
            className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100"
          >
            Zwiń wszystko
          </button>
        </div>
      </div>

      {displayGroups.map((group) => {
        const items = group.items.filter((i): i is TeethQueueItem => !isScheduledItem(i));
        const sections = groupTeethQueueByProductLine(items, readinessCtx);
        const supplierKey = `s:${group.supplierId ?? "__no_supplier"}`;
        const sectionDomId = (key: string) =>
          teethLineSectionDomId("historia", group.supplierId, key);
        const supplierOpen = isExpanded(supplierKey, forceOpen || hasLateItems(items));
        const bodyId = `teeth-historia-body-${(group.supplierId ?? "none").replace(/[^a-z0-9-]/gi, "")}`;
        return (
          <section
            key={supplierKey}
            aria-label={`Dostawca ${group.supplierName}`}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <header className={cn("px-4 py-3 sm:px-5", supplierOpen && "border-b border-slate-100")}>
              <button
                type="button"
                onClick={() => setExpanded(supplierKey, !supplierOpen)}
                aria-expanded={supplierOpen}
                aria-controls={bodyId}
                className="-mx-1 flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-slate-50"
              >
                <IconChevronDown
                  size={16}
                  className={cn("shrink-0 text-slate-400 transition-transform", !supplierOpen && "-rotate-90")}
                  aria-hidden
                />
                <h2 className="text-base font-semibold text-slate-900">{group.supplierName}</h2>
                <span className="text-xs text-slate-500">
                  {items.length} {plZamowienie(items.length)}
                  {sections.length > 1 ? ` · ${sections.length} linie` : ""}
                </span>
                <span className="ml-auto">
                  <HistoryStateSummary items={items} />
                </span>
              </button>
              <TeethProductLineChips
                sections={sections.map((sec) => ({ ...sec, count: sec.items.length }))}
                sectionDomId={sectionDomId}
                onSelect={(key) => {
                  setExpandOverrides((prev) =>
                    new Map(prev).set(supplierKey, true).set(`${supplierKey}|${key}`, true),
                  );
                }}
              />
            </header>
            {supplierOpen ? (
              <div id={bodyId}>
                {sections.map((section) => {
                  const lineKey = `${supplierKey}|${section.key}`;
                  const lineOpen = isExpanded(
                    lineKey,
                    forceOpen || sections.length === 1 || hasActiveHistoryItems(section.items),
                  );
                  const listId = `${sectionDomId(section.key)}-list`;
                  return (
                    <section
                      key={section.key}
                      id={sectionDomId(section.key)}
                      aria-label={`Linia ${section.label}`}
                      className="scroll-mt-24 border-b border-slate-200 last:border-b-0"
                    >
                      <TeethProductLineSectionHeader
                        productLine={section.productLine}
                        label={section.label}
                        meta={`${section.items.length} ${plZamowienie(section.items.length)}`}
                        expanded={lineOpen}
                        onToggle={() => setExpanded(lineKey, !lineOpen)}
                        controlsId={listId}
                        trailing={lineOpen ? null : <HistoryStateSummary items={section.items} />}
                      />
                      {lineOpen ? (
                        <ul id={listId} className="divide-y divide-slate-100">
                          {section.items.map((item) => (
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
                      ) : null}
                    </section>
                  );
                })}
              </div>
            ) : null}
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
