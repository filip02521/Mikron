"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatPlDate, vacationNoteLabel } from "@/lib/display-labels";
import type { DayOfWeek, TeethSupplierSchedule } from "@/types/database";
import { DAY_OF_WEEK_LABELS } from "@/lib/data/teeth-schedule";
import { TEETH_DUAL_LANE_COPY } from "@/lib/teeth/teeth-supplier-dual-lane";
import {
  actionFetchTeethScheduleForSupplier,
  actionDisableTeethSchedule,
  actionShiftTeethSchedule,
  actionUpsertTeethSchedule,
} from "@/app/actions/teeth-orders";
import { SupplierFormSection } from "@/components/admin/SupplierFormSection";
import { Field, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ModalShell } from "@/components/ui/ModalShell";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { IconCalendar } from "@/components/icons/StrokeIcons";
import { plCoTydzien } from "@/lib/ui/polish-plurals";
import { panelTypography } from "@/lib/ui/ontime-theme";
import { TEETH_SCHEDULE_TOAST, toastFromError, type ToastNotice } from "@/lib/ui/notice-copy";

const WEEKDAYS: DayOfWeek[] = [1, 2, 3, 4, 5];

export function TeethSupplierScheduleFields({
  supplierId,
  supplierName,
  disabled = false,
  onToast,
}: {
  supplierId: string;
  supplierName: string;
  disabled?: boolean;
  onToast: (notice: ToastNotice) => void;
}) {
  const [schedule, setSchedule] = useState<TeethSupplierSchedule | null | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [orderDay, setOrderDay] = useState<DayOfWeek>(1);
  const [intervalWeeks, setIntervalWeeks] = useState(1);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [shiftDate, setShiftDate] = useState("");
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

  const onToastRef = useRef(onToast);
  useEffect(() => { onToastRef.current = onToast; });

  const reload = useCallback(async () => {
    try {
      const row = await actionFetchTeethScheduleForSupplier(supplierId);
      setSchedule(row);
      if (row) {
        setOrderDay(row.order_day_of_week);
        setIntervalWeeks(row.interval_weeks);
        setShiftDate(row.shift_date ?? "");
      }
    } catch (e) {
      onToastRef.current(toastFromError(e instanceof Error ? e.message : undefined, TEETH_SCHEDULE_TOAST.loadFailed.text));
      setSchedule(null);
    }
  }, [supplierId]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      void (async () => {
        if (cancelled) return;
        await reload();
      })();
    });
    return () => { cancelled = true; };
  }, [reload]);

  const handleUpsert = useCallback(async () => {
    setPending(true);
    try {
      await actionUpsertTeethSchedule(supplierId, orderDay, intervalWeeks);
      onToastRef.current(TEETH_SCHEDULE_TOAST.saved);
      await reload();
    } catch (e) {
      onToastRef.current(toastFromError(e instanceof Error ? e.message : undefined, TEETH_SCHEDULE_TOAST.saveFailed.text));
    } finally {
      setPending(false);
    }
  }, [supplierId, orderDay, intervalWeeks, reload]);

  const handleRemove = useCallback(async () => {
    setConfirmRemoveOpen(false);
    setPending(true);
    try {
      await actionDisableTeethSchedule(supplierId);
      onToastRef.current(TEETH_SCHEDULE_TOAST.disabled);
      await reload();
    } catch (e) {
      onToastRef.current(toastFromError(e instanceof Error ? e.message : undefined, TEETH_SCHEDULE_TOAST.removeFailed.text));
    } finally {
      setPending(false);
    }
  }, [supplierId, reload]);

  const handleShift = useCallback(
    async (clear: boolean) => {
      setShiftOpen(false);
      setPending(true);
      try {
        await actionShiftTeethSchedule(supplierId, clear ? null : shiftDate || null);
        onToastRef.current(
          clear
            ? TEETH_SCHEDULE_TOAST.shiftRestored
            : shiftDate
              ? TEETH_SCHEDULE_TOAST.shiftToDate(formatPlDate(shiftDate))
              : TEETH_SCHEDULE_TOAST.shiftUpdated,
        );
        await reload();
      } catch (e) {
        onToastRef.current(toastFromError(e instanceof Error ? e.message : undefined, TEETH_SCHEDULE_TOAST.shiftFailed.text));
      } finally {
        setPending(false);
      }
    },
    [supplierId, shiftDate, reload]
  );

  if (schedule === undefined) {
    return (
      <SupplierFormSection
        title="Cykl zębów"
        description="Wczytywanie…"
        defaultOpen
      >
        <p className="text-sm text-slate-500">Ładowanie ustawień cyklu…</p>
      </SupplierFormSection>
    );
  }

  return (
    <>
      <SupplierFormSection
        title="Cykl zębów"
        description={`Osobny harmonogram toru zębów dla ${supplierName} — niezależny od panelu dziennego.`}
        defaultOpen
      >
        <p className="mb-3 rounded-md border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-xs leading-relaxed text-emerald-950 sm:col-span-2">
          {TEETH_DUAL_LANE_COPY.harmonogramBannerBody}
        </p>

        {schedule ? (
          <div className="space-y-3 sm:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              {schedule.computed_next_date ? (
                <Badge variant="info">
                  Następne zamówienie: {formatPlDate(schedule.computed_next_date)}
                </Badge>
              ) : null}
              {schedule.vacation_note ? (
                <Badge variant="warning">
                  {vacationNoteLabel(schedule.vacation_note)}
                </Badge>
              ) : null}
              {schedule.shift_date ? (
                <Badge variant="warning">
                  Przesunięte: {formatPlDate(schedule.shift_date)}
                </Badge>
              ) : null}
              {schedule.last_order_date ? (
                <span className={panelTypography.rowMeta}>
                  Ostatnie: {formatPlDate(schedule.last_order_date)}
                </span>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Dzień zamówienia u dostawcy">
                <Select
                  value={String(orderDay)}
                  disabled={disabled || pending}
                  onChange={(e) => setOrderDay(Number(e.target.value) as DayOfWeek)}
                >
                  {WEEKDAYS.map((d) => (
                    <option key={d} value={String(d)}>
                      {DAY_OF_WEEK_LABELS[d]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Częstotliwość">
                <Select
                  value={String(intervalWeeks)}
                  disabled={disabled || pending}
                  onChange={(e) => setIntervalWeeks(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={String(n)}>
                      {plCoTydzien(n)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={disabled || pending}
                onClick={() => void handleUpsert()}
              >
                Zapisz cykl
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={disabled || pending}
                onClick={() => setShiftOpen(true)}
              >
                <IconCalendar size={16} className="mr-1.5" />
                Przesuń termin
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-red-700 hover:bg-red-50"
                disabled={disabled || pending}
                onClick={() => setConfirmRemoveOpen(true)}
              >
                Wyłącz cykl
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 sm:col-span-2">
            <p className="text-sm text-slate-600">
              Brak cyklu zębów — ustaw dzień i częstotliwość, aby dostawca pojawiał się w kolejce
              z cyklicznym zamówieniem.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Dzień zamówienia u dostawcy">
                <Select
                  value={String(orderDay)}
                  disabled={disabled || pending}
                  onChange={(e) => setOrderDay(Number(e.target.value) as DayOfWeek)}
                >
                  {WEEKDAYS.map((d) => (
                    <option key={d} value={String(d)}>
                      {DAY_OF_WEEK_LABELS[d]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Częstotliwość">
                <Select
                  value={String(intervalWeeks)}
                  disabled={disabled || pending}
                  onChange={(e) => setIntervalWeeks(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={String(n)}>
                      {plCoTydzien(n)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={disabled || pending}
              onClick={() => void handleUpsert()}
            >
              Włącz cykl zębów
            </Button>
          </div>
        )}
      </SupplierFormSection>

      <ModalShell
        open={shiftOpen}
        onClose={() => !pending && setShiftOpen(false)}
        title="Przesuń termin cyklu zębów"
        description="Jednorazowa data następnego zamówienia. „Wyczyść” przywraca automatyczne wyliczenie."
        size="sm"
        bodyClassName="p-5 sm:p-6"
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => void handleShift(true)}
              className="text-slate-600 hover:bg-slate-100"
            >
              Wyczyść przesunięcie
            </Button>
            <Button type="button" disabled={pending} onClick={() => void handleShift(false)}>
              Zapisz datę
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-sky-100 bg-sky-50/60 px-3.5 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
              <IconCalendar size={16} />
            </span>
            <p className="text-xs leading-relaxed text-sky-900">
              Wybierz datę, na którą chcesz jednorazowo przesunąć następne zamówienie u{" "}
              <strong>{supplierName}</strong>. Po tym terminie cykl wróci do automatycznego wyliczenia.
            </p>
          </div>
          <Field label="Data następnego zamówienia">
            <Input
              type="date"
              value={shiftDate}
              disabled={pending}
              onChange={(e) => setShiftDate(e.target.value)}
              className="w-full"
            />
          </Field>
        </div>
      </ModalShell>

      <ConfirmDialog
        open={confirmRemoveOpen}
        title="Wyłączyć cykl zębów?"
        message={`${supplierName} zniknie z cyklicznych przypomnień w kolejce zębów. Prośby handlowców nadal będą działać.`}
        confirmLabel="Wyłącz cykl"
        danger
        pending={pending}
        onCancel={() => setConfirmRemoveOpen(false)}
        onConfirm={() => void handleRemove()}
      />
    </>
  );
}
