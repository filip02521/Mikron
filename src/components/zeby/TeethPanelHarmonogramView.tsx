"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPlDate } from "@/lib/display-labels";
import type { DayOfWeek, TeethSupplierScheduleWithSupplier } from "@/types/database";
import { DAY_OF_WEEK_LABELS, DAY_OF_WEEK_SHORT } from "@/lib/data/teeth-schedule";
import {
  TEETH_MARK_ORDERED_LABEL,
  TEETH_MARK_ORDERED_TITLE,
} from "@/components/zeby/teeth-panel-copy";
import { TeethPanelEmpty, TeethPanelSection } from "@/components/zeby/TeethPanelSection";
import {
  actionFetchTeethSchedules,
  actionFetchAvailableSuppliersForTeethSchedule,
  actionUpsertTeethSchedule,
  actionRemoveTeethSchedule,
  actionShiftTeethSchedule,
  actionMarkTeethScheduleOrdered,
} from "@/app/actions/teeth-orders";
import { cn } from "@/lib/cn";
import { panelTypography } from "@/lib/ui/ontime-theme";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, Select, Input } from "@/components/ui/Field";
import { CardHeader } from "@/components/ui/Card";
import { IconCalendar, IconTrash2, IconTruck } from "@/components/icons/StrokeIcons";
import { plCoTydzien } from "@/lib/ui/polish-plurals";

type ToastState = { message: string; tone: "success" | "error" } | null;

function formatQueueStatsBadge(stats: { pendingCount: number; missingSpecCount: number }): string {
  const n = stats.pendingCount;
  const prosby =
    n === 1 ? "prośba" : n >= 2 && n <= 4 ? "prośby" : "prośb";
  return `Kolejka: ${n} ${prosby} · ${stats.missingSpecCount} do uzupełnienia`;
}

export function TeethPanelHarmonogramView({
  onToast,
  queueStatsBySupplier,
}: {
  onToast: (toast: ToastState) => void;
  queueStatsBySupplier: Map<string, { pendingCount: number; missingSpecCount: number }>;
}) {
  const [schedules, setSchedules] = useState<TeethSupplierScheduleWithSupplier[] | null>(null);
  const [availableSuppliers, setAvailableSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(1);
  const [selectedInterval, setSelectedInterval] = useState(1);

  const [shiftSupplierId, setShiftSupplierId] = useState<string | null>(null);
  const [shiftDate, setShiftDate] = useState("");
  const [confirmShiftOpen, setConfirmShiftOpen] = useState(false);

  const [removeSupplierId, setRemoveSupplierId] = useState<string | null>(null);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [schedResult, suppliers] = await Promise.all([
        actionFetchTeethSchedules(),
        actionFetchAvailableSuppliersForTeethSchedule(),
      ]);
      setSchedules(schedResult.schedules);
      setAvailableSuppliers(suppliers);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd ładowania harmonogramu");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pierwsze pobranie harmonogramu po montażu widoku
    void loadData();
  }, [loadData]);

  const handleAddSupplier = useCallback(async () => {
    if (!selectedSupplierId) return;
    setPending(true);
    try {
      await actionUpsertTeethSchedule(selectedSupplierId, selectedDay, selectedInterval);
      onToast({
        message: "Dodano dostawcę do harmonogramu",
        tone: "success",
      });
      setSelectedSupplierId("");
      setSelectedDay(1);
      setSelectedInterval(1);
      await loadData();
    } catch (e) {
      onToast({
        message: e instanceof Error ? e.message : "Błąd dodawania dostawcy",
        tone: "error",
      });
    } finally {
      setPending(false);
    }
  }, [selectedSupplierId, selectedDay, selectedInterval, loadData, onToast]);

  const handleUpdateSchedule = useCallback(
    async (supplierId: string, day: DayOfWeek, interval: number) => {
      setPending(true);
      try {
        await actionUpsertTeethSchedule(supplierId, day, interval);
        onToast({ message: "Zaktualizowano harmonogram", tone: "success" });
        await loadData();
      } catch (e) {
        onToast({
          message: e instanceof Error ? e.message : "Błąd aktualizacji harmonogramu",
          tone: "error",
        });
      } finally {
        setPending(false);
      }
    },
    [loadData, onToast],
  );

  const handleRemoveSchedule = useCallback(async () => {
    if (!removeSupplierId) return;
    setConfirmRemoveOpen(false);
    setPending(true);
    try {
      await actionRemoveTeethSchedule(removeSupplierId);
      onToast({ message: "Usunięto dostawcę z harmonogramu", tone: "success" });
      setRemoveSupplierId(null);
      await loadData();
    } catch (e) {
      onToast({
        message: e instanceof Error ? e.message : "Błąd usuwania dostawcy",
        tone: "error",
      });
    } finally {
      setPending(false);
    }
  }, [removeSupplierId, loadData, onToast]);

  const handleShiftSchedule = useCallback(
    async (overrideDate?: string) => {
      if (!shiftSupplierId) return;
      setConfirmShiftOpen(false);
      setPending(true);
      try {
        const dateToSave = overrideDate !== undefined ? overrideDate : shiftDate;
        await actionShiftTeethSchedule(shiftSupplierId, dateToSave || null);
        onToast({
          message: dateToSave
            ? `Przesunięto termin na ${formatPlDate(dateToSave)}`
            : "Przywrócono automatyczny termin harmonogramu",
          tone: "success",
        });
        setShiftSupplierId(null);
        setShiftDate("");
        await loadData();
      } catch (e) {
        onToast({
          message: e instanceof Error ? e.message : "Błąd przesuwania harmonogramu",
          tone: "error",
        });
      } finally {
        setPending(false);
      }
    },
    [shiftSupplierId, shiftDate, loadData, onToast],
  );

  const handleMarkScheduleOrdered = useCallback(
    async (supplierId: string, supplierName: string) => {
      setPending(true);
      try {
        await actionMarkTeethScheduleOrdered(supplierId);
        onToast({
          message: `Potwierdzono zamówienie cykliczne u dostawcy ${supplierName} — harmonogram przesunięty na następny termin`,
          tone: "success",
        });
        await loadData();
      } catch (e) {
        onToast({
          message: e instanceof Error ? e.message : "Błąd oznaczania zamówienia",
          tone: "error",
        });
      } finally {
        setPending(false);
      }
    },
    [loadData, onToast],
  );

  if (error) {
    return (
      <TeethPanelEmpty
        title="Nie udało się wczytać harmonogramu"
        description={error}
        icon={<IconCalendar size={24} strokeWidth={1.75} />}
      />
    );
  }

  if (schedules === null) {
    return (
      <TeethPanelEmpty
        title="Wczytywanie harmonogramu…"
        icon={<IconCalendar size={24} strokeWidth={1.75} />}
      />
    );
  }

  return (
    <div className="space-y-3">
      {availableSuppliers.length > 0 ? (
        <TeethPanelSection
          title="Dodaj dostawcę"
          hint="Ustal dzień tygodnia i częstotliwość cyklicznych zamówień zębów."
          icon={<IconCalendar size={18} strokeWidth={1.75} />}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <Field label="Dostawca" className="sm:col-span-2 lg:col-span-1">
              <Select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full"
              >
                <option value="">Wybierz dostawcę…</option>
                {availableSuppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Dzień zamówienia">
              <Select
                value={String(selectedDay)}
                onChange={(e) => setSelectedDay(Number(e.target.value) as DayOfWeek)}
                className="w-full"
              >
                {([1, 2, 3, 4, 5] as DayOfWeek[]).map((d) => (
                  <option key={d} value={String(d)}>
                    {DAY_OF_WEEK_LABELS[d]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Częstotliwość">
              <Select
                value={String(selectedInterval)}
                onChange={(e) => setSelectedInterval(Number(e.target.value))}
                className="w-full"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={String(n)}>
                    {plCoTydzien(n)}
                  </option>
                ))}
              </Select>
            </Field>
            <Button
              size="sm"
              onClick={handleAddSupplier}
              disabled={pending || !selectedSupplierId}
              className="min-h-10 w-full sm:w-auto"
            >
              Dodaj do harmonogramu
            </Button>
          </div>
        </TeethPanelSection>
      ) : null}

      {schedules.length === 0 ? (
        <TeethPanelEmpty
          title="Harmonogram jest pusty"
          description="Dodaj dostawcę powyżej, aby system przypominał o cyklicznych zamówieniach zębów."
          icon={<IconCalendar size={24} strokeWidth={1.75} />}
        />
      ) : (
        <div className="overflow-hidden rounded-md border border-slate-200/80 bg-[var(--card)] shadow-sm">
          <CardHeader
            inset
            density="compact"
            title="Aktywni dostawcy"
            description="Edytuj dzień i częstotliwość bezpośrednio na liście."
          />
          <div className="divide-y divide-slate-100">
            {schedules.map((sched) => {
              const queueStats = queueStatsBySupplier.get(sched.supplier_id);
              return (
                <div key={sched.id} className={cn("space-y-2 px-2.5 py-2 sm:px-3")}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className={panelTypography.rowTitle}>{sched.supplier_name}</span>
                      {queueStats ? (
                        <Badge variant="default" className="text-[10px]">
                          {formatQueueStatsBadge(queueStats)}
                        </Badge>
                      ) : null}
                      {sched.computed_next_date ? (
                        <Badge variant="info" className="text-[10px]">
                          Następne: {formatPlDate(sched.computed_next_date)}
                        </Badge>
                      ) : null}
                      {sched.shift_date ? (
                        <Badge variant="warning" className="text-[10px]">
                          Przesunięte: {formatPlDate(sched.shift_date)}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {sched.computed_next_date ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="min-h-9"
                          onClick={() =>
                            handleMarkScheduleOrdered(sched.supplier_id, sched.supplier_name)
                          }
                          disabled={pending}
                          title={TEETH_MARK_ORDERED_TITLE}
                        >
                          <IconTruck size={16} strokeWidth={2} />
                          {TEETH_MARK_ORDERED_LABEL}
                        </Button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setShiftSupplierId(sched.supplier_id);
                          setShiftDate(sched.shift_date ?? "");
                          setConfirmShiftOpen(true);
                        }}
                        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        title="Przesuń termin jednorazowo"
                        aria-label="Przesuń termin jednorazowo"
                      >
                        <IconCalendar size={16} strokeWidth={1.75} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRemoveSupplierId(sched.supplier_id);
                          setConfirmRemoveOpen(true);
                        }}
                        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        title="Usuń z harmonogramu"
                        aria-label="Usuń z harmonogramu"
                      >
                        <IconTrash2 size={16} strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <Field label="Dzień zamówienia" className="min-w-[9rem]">
                      <Select
                        value={String(sched.order_day_of_week)}
                        onChange={(e) =>
                          handleUpdateSchedule(
                            sched.supplier_id,
                            Number(e.target.value) as DayOfWeek,
                            sched.interval_weeks,
                          )
                        }
                        disabled={pending}
                      >
                        {([1, 2, 3, 4, 5] as DayOfWeek[]).map((d) => (
                          <option key={d} value={String(d)}>
                            {DAY_OF_WEEK_SHORT[d]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Częstotliwość" className="min-w-[9rem]">
                      <Select
                        value={String(sched.interval_weeks)}
                        onChange={(e) =>
                          handleUpdateSchedule(
                            sched.supplier_id,
                            sched.order_day_of_week,
                            Number(e.target.value),
                          )
                        }
                        disabled={pending}
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={String(n)}>
                            {plCoTydzien(n)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    {sched.last_order_date ? (
                      <span className={panelTypography.rowMeta}>
                        Ostatnie zamówienie: {formatPlDate(sched.last_order_date)}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ModalShell
        open={confirmShiftOpen}
        onClose={() => {
          setConfirmShiftOpen(false);
          setShiftSupplierId(null);
          setShiftDate("");
        }}
        title="Przesuń termin harmonogramu"
        description='Podaj datę jednorazowego przesunięcia. Aby wrócić do automatycznego wyliczenia, kliknij „Wyczyść”.'
        size="sm"
        tier="raised"
        bodyClassName="px-5 py-4 sm:px-6"
        loadingMessage={pending ? "Przetwarzanie…" : null}
        disableBackdropClose={pending}
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              className="min-h-11 w-full sm:w-auto"
              onClick={() => {
                setConfirmShiftOpen(false);
                setShiftSupplierId(null);
                setShiftDate("");
              }}
              disabled={pending}
            >
              Anuluj
            </Button>
            {shiftDate ? (
              <Button
                variant="ghost"
                className="min-h-11 w-full text-red-600 hover:text-red-700 sm:w-auto"
                onClick={() => handleShiftSchedule("")}
                disabled={pending}
              >
                Wyczyść
              </Button>
            ) : null}
            <Button
              className="min-h-11 w-full sm:w-auto"
              onClick={() => handleShiftSchedule()}
              disabled={pending}
            >
              {shiftDate ? "Przesuń" : "Zapisz"}
            </Button>
          </div>
        }
      >
        <Input
          type="date"
          value={shiftDate}
          onChange={(e) => setShiftDate(e.target.value)}
          className="w-full"
        />
      </ModalShell>

      <ConfirmDialog
        open={confirmRemoveOpen}
        title="Usuń dostawcę z harmonogramu"
        message="Czy na pewno chcesz usunąć tego dostawcę z harmonogramu? Dotychczasowa historia zamówień pozostanie bez zmian."
        confirmLabel="Usuń"
        cancelLabel="Anuluj"
        pending={pending}
        onConfirm={handleRemoveSchedule}
        onCancel={() => {
          setConfirmRemoveOpen(false);
          setRemoveSupplierId(null);
        }}
      />
    </div>
  );
}
