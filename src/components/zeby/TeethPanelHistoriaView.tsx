"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ModalShell } from "@/components/ui/ModalShell";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { panelSubsectionInsetClass } from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";
import { TeethPanelEmpty } from "@/components/zeby/TeethPanelSection";
import { TeethPanelOrderEntry } from "@/components/zeby/TeethPanelOrderEntry";
import { TeethPanelSupplierGroupHeader } from "@/components/zeby/TeethPanelSupplierGroupHeader";
import { TeethSupplierBatchSummary } from "@/components/teeth/TeethSupplierBatchSummary";
import { buildTeethSupplierBatchSummary } from "@/lib/teeth/teeth-panel-aggregate";
import type { TeethPanelReadinessContext } from "@/lib/teeth/teeth-panel-order-readiness";
import {
  EMPTY_TEETH_PANEL_FILTERS,
  filterTeethHistoryGroups,
  countActiveTeethPanelFilters,
  type TeethPanelFilters,
} from "@/lib/teeth/teeth-panel-filters";
import { teethPanelSupplierCardClass } from "@/lib/teeth/teeth-panel-ui";
import type { TeethQueueGroup, TeethQueueItem } from "@/lib/data/teeth-queue";
import { isScheduledItem } from "@/lib/data/teeth-queue";
import {
  actionFetchTeethHistoryGroups,
  actionOverrideTeethDeliveryDate,
  actionClearTeethDeliveryDateOverride,
  actionUnmarkTeethOrdered,
} from "@/app/actions/teeth-orders";
import { IconCircleCheck } from "@/components/icons/StrokeIcons";

type ToastState = { message: string; tone: "success" | "error" } | null;

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
  onToast: (toast: ToastState) => void;
  onReloadQueue?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(groups === null);
  const [historyGroups, setHistoryGroups] = useState<TeethQueueGroup[] | null>(groups);
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [dateValue, setDateValue] = useState("");
  const [datePending, setDatePending] = useState(false);
  const [unmarkId, setUnmarkId] = useState<string | null>(null);
  const [unmarkPending, setUnmarkPending] = useState(false);

  const reloadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await actionFetchTeethHistoryGroups();
      setHistoryGroups(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd ładowania historii");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pierwsze pobranie historii po montażu widoku
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
        onToast({ message: "Ustawiono datę dostawy", tone: "success" });
      } else {
        await actionClearTeethDeliveryDateOverride([editingDateId]);
        onToast({ message: "Wyczyszczono datę dostawy", tone: "success" });
      }
      setEditingDateId(null);
      setDateValue("");
      await reloadHistory();
    } catch (e) {
      onToast({
        message: e instanceof Error ? e.message : "Błąd ustawiania daty dostawy",
        tone: "error",
      });
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
      onToast({
        message: e instanceof Error ? e.message : "Błąd czyszczenia daty dostawy",
        tone: "error",
      });
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
        onToast({
          message: "Nie udało się cofnąć — pozycja mogła zmienić status.",
          tone: "error",
        });
      } else {
        onToast({
          message: "Cofnięto oznaczenie — pozycja wróciła do kolejki.",
          tone: "success",
        });
        onReloadQueue?.();
        await reloadHistory();
      }
      setUnmarkId(null);
    } catch (e) {
      onToast({
        message: e instanceof Error ? e.message : "Błąd cofania zamówienia",
        tone: "error",
      });
    } finally {
      setUnmarkPending(false);
    }
  }, [unmarkId, onToast, onReloadQueue, reloadHistory]);

  if (error) {
    return (
      <TeethPanelEmpty
        title="Nie udało się wczytać historii"
        description={error}
        icon={<IconCircleCheck size={24} strokeWidth={1.75} />}
      />
    );
  }

  if (loading || historyGroups === null) {
    return (
      <TeethPanelEmpty
        title="Wczytywanie historii…"
        icon={<IconCircleCheck size={24} strokeWidth={1.75} />}
      />
    );
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
        icon={<IconCircleCheck size={24} strokeWidth={1.75} />}
      />
    );
  }

  return (
    <>
      {displayGroups.map((group) => {
        const items = group.items.filter(
          (i): i is TeethQueueItem => !isScheduledItem(i),
        );
        const batchSummary =
          items.length >= 2 ? buildTeethSupplierBatchSummary(items, readinessCtx) : null;

        return (
          <div key={group.supplierId ?? "__no_supplier"} className={teethPanelSupplierCardClass}>
            <TeethPanelSupplierGroupHeader group={group} orderCount={items.length} />

            {batchSummary ? <TeethSupplierBatchSummary batch={batchSummary} /> : null}

            {batchSummary ? (
              <div
                className={cn(
                  "border-t border-slate-100 py-1.5",
                  panelSubsectionInsetClass,
                )}
              >
                <span className="text-xs text-slate-500">Prośby handlowców</span>
              </div>
            ) : null}

            <div>
              {items.map((item) => (
                <TeethPanelOrderEntry
                  key={item.id}
                  item={item}
                  variant="history"
                  mergedBatch={Boolean(batchSummary)}
                  supplierName={group.supplierName}
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
