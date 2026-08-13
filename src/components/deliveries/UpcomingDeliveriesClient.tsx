"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import { addDays } from "date-fns";
import { actionFetchUpcomingDeliveries } from "@/app/actions/upcoming-deliveries";
import type { UpcomingDeliveriesPayload } from "@/app/actions/upcoming-deliveries";
import {
  buildDeliveryScheduleWeek,
  buildDeliveryTodayDay,
  clearedSupplierIdsByDateFromPayload,
  hideScheduledReceivedToday,
  summarizeDeliverySchedule,
  upcomingDeliveryPresetRange,
  type UpcomingDeliveryRangePreset,
} from "@/lib/data/upcoming-deliveries-shared";
import { formatDateString } from "@/lib/orders/dates";
import { useLatest } from "@/hooks/useLatest";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Button } from "@/components/ui/Button";
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconTruck,
} from "@/components/icons/StrokeIcons";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { cn } from "@/lib/cn";
import {
  panelSectionInsetClass,
  panelTypography,
  sectionIconTileBrandClass,
} from "@/lib/ui/ontime-theme";
import { UpcomingDeliverySummaryTiles } from "@/components/deliveries/UpcomingDeliverySummaryTiles";
import { DeliveryTodaySection } from "@/components/deliveries/DeliveryTodaySection";
import { DeliveryWeekGrid } from "@/components/deliveries/DeliveryWeekGrid";
import type { SupplierWithSchedule } from "@/types/database";

const PRESET_OPTIONS: { value: UpcomingDeliveryRangePreset; label: string }[] = [
  { value: "week", label: "Tydzień" },
  { value: "7days", label: "7 dni" },
  { value: "14days", label: "14 dni" },
];

/** Odświeżanie planu przy otwartej karcie — przyjęcia z innych zakładek. */
const AUTO_REFRESH_MS = 45_000;

function shiftDateRange(
  dateFrom: string,
  dateTo: string,
  direction: -1 | 1
): { dateFrom: string; dateTo: string } {
  if (!dateFrom || !dateTo) return { dateFrom, dateTo };
  const from = new Date(`${dateFrom}T12:00:00`);
  const to = new Date(`${dateTo}T12:00:00`);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return { dateFrom, dateTo };
  const span = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  const shift = Math.max(span + 1, 7);
  const newFrom = addDays(from, direction * shift);
  const newTo = addDays(to, direction * shift);
  return { dateFrom: formatDateString(newFrom), dateTo: formatDateString(newTo) };
}

function formatRangeLabel(dateFrom: string, dateTo: string): string {
  const from = dateFrom.split("-").reverse().join(".");
  const to = dateTo.split("-").reverse().join(".");
  return `${from} – ${to}`;
}

export function UpcomingDeliveriesClient({
  initialPayload,
  loadError,
  isAuthorized,
  supplierSchedules,
  todayDateKey,
}: {
  initialPayload: UpcomingDeliveriesPayload | null;
  loadError: string | null;
  isAuthorized: boolean;
  supplierSchedules: SupplierWithSchedule[];
  todayDateKey: string;
}) {
  const [payload, setPayload] = useState<UpcomingDeliveriesPayload | null>(initialPayload);
  const [error, setError] = useState<string | null>(loadError);
  const [preset, setPreset] = useState<UpcomingDeliveryRangePreset | "custom">("week");
  const [dateFrom, setDateFrom] = useState(initialPayload?.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(initialPayload?.dateTo ?? "");
  const [pending, start] = useTransition();
  const dateFromRef = useLatest(dateFrom);
  const dateToRef = useLatest(dateTo);
  const loadGenerationRef = useRef(0);

  useEffect(() => {
    if (!initialPayload) return;
    queueMicrotask(() => {
      setPayload(initialPayload);
      setDateFrom(initialPayload.dateFrom);
      setDateTo(initialPayload.dateTo);
      setError(loadError);
    });
  }, [initialPayload, loadError]);

  const loadData = useCallback((from: string, to: string) => {
    const generation = ++loadGenerationRef.current;
    start(async () => {
      try {
        const next = await actionFetchUpcomingDeliveries(from, to);
        if (generation !== loadGenerationRef.current) return;
        setPayload(next);
        setDateFrom(next.dateFrom);
        setDateTo(next.dateTo);
        setError(null);
      } catch (e) {
        if (generation !== loadGenerationRef.current) return;
        setError(userFacingErrorText(e, "Błąd ładowania dostaw."));
      }
    });
  }, []);

  const refreshQuiet = useCallback(() => {
    const from = dateFromRef.current;
    const to = dateToRef.current;
    if (!from || !to) return;
    loadData(from, to);
  }, [loadData, dateFromRef, dateToRef]);

  useEffect(() => {
    if (!isAuthorized) return;
    const onVis = () => {
      if (document.visibilityState === "visible") refreshQuiet();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", refreshQuiet);
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshQuiet();
    }, AUTO_REFRESH_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", refreshQuiet);
      window.clearInterval(id);
    };
  }, [isAuthorized, refreshQuiet]);

  const handlePresetChange = useCallback(
    (value: UpcomingDeliveryRangePreset) => {
      setPreset(value);
      const { dateFrom: from, dateTo: to } = upcomingDeliveryPresetRange(value);
      loadData(from, to);
    },
    [loadData]
  );

  const handlePrev = useCallback(() => {
    setPreset("custom");
    const next = shiftDateRange(dateFrom, dateTo, -1);
    loadData(next.dateFrom, next.dateTo);
  }, [dateFrom, dateTo, loadData]);

  const handleNext = useCallback(() => {
    setPreset("custom");
    const next = shiftDateRange(dateFrom, dateTo, 1);
    loadData(next.dateFrom, next.dateTo);
  }, [dateFrom, dateTo, loadData]);

  const days = useMemo(() => payload?.days ?? [], [payload?.days]);
  const summary = payload?.summary;
  const journalReceivedToday = useMemo(
    () => payload?.receivedSupplierIdsToday ?? [],
    [payload?.receivedSupplierIdsToday]
  );
  const clearedByDate = useMemo(
    () => clearedSupplierIdsByDateFromPayload(payload?.clearedSupplierIdsByDate),
    [payload?.clearedSupplierIdsByDate]
  );
  const rangeLabel = useMemo(() => {
    if (!dateFrom || !dateTo) return "";
    return formatRangeLabel(dateFrom, dateTo);
  }, [dateFrom, dateTo]);

  const weekDays = useMemo(() => {
    const built = buildDeliveryScheduleWeek(
      supplierSchedules,
      days,
      todayDateKey,
      dateFrom || undefined
    );
    return hideScheduledReceivedToday(built, journalReceivedToday, clearedByDate);
  }, [supplierSchedules, days, todayDateKey, dateFrom, journalReceivedToday, clearedByDate]);

  const todayDay = useMemo(() => {
    const fromWeek = weekDays.find((d) => d.isToday) ?? null;
    if (fromWeek) return fromWeek;
    // Sobota/niedziela: siatka Pn–Pt nie ma kolumny „dziś”.
    const weekend = buildDeliveryTodayDay(supplierSchedules, days, todayDateKey);
    if (!weekend) return null;
    return hideScheduledReceivedToday([weekend], journalReceivedToday, clearedByDate)[0] ?? null;
  }, [weekDays, supplierSchedules, days, todayDateKey, journalReceivedToday, clearedByDate]);

  const extendedSummary = useMemo(() => {
    if (!summary) return null;
    const base = summarizeDeliverySchedule(summary, weekDays);
    if (!todayDay || weekDays.some((d) => d.isToday)) return base;
    return {
      ...base,
      todayDeliveryCount: todayDay.deliveryDay?.suppliers.length ?? 0,
      todayScheduledCount: todayDay.scheduledSuppliers.length,
    };
  }, [summary, weekDays, todayDay]);

  const weekGridEmpty = weekDays.every(
    (d) => d.scheduledSuppliers.length === 0 && (!d.deliveryDay || d.deliveryDay.suppliers.length === 0)
  );

  if (!isAuthorized) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Card>
          <EmptyState
            title="Brak uprawnień"
            description="Panel dostaw jest dostępny dla działu magazynu."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <Card padding={false} className="overflow-hidden">
        <CardHeader
          title="Plan dostaw"
          description="Centrum dowodzenia — planowi dostawcy i zamówienia ZD"
          hint="Plan dostawców na podstawie harmonogramu + dokumenty ZD z Subiekta. Odświeża się automatycznie."
          density="compact"
          inset
          leading={
            <SectionHeadingIcon tileClassName={sectionIconTileBrandClass} className="h-7 w-7">
              <IconTruck size={16} />
            </SectionHeadingIcon>
          }
          action={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshQuiet}
                disabled={pending || !dateFrom || !dateTo}
                title="Odśwież plan"
              >
                Odśwież
              </Button>
              <SegmentedControl
                value={preset === "custom" ? ("" as UpcomingDeliveryRangePreset) : preset}
                onChange={handlePresetChange}
                options={PRESET_OPTIONS}
                ariaLabel="Zakres czasowy dostaw"
              />
            </div>
          }
        />

        <div className={cn(panelSectionInsetClass, "space-y-3 border-b border-slate-100")}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrev}
                disabled={pending}
                title="Poprzedni okres"
              >
                <IconChevronLeft size={16} />
              </Button>
              <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                <IconCalendar size={14} />
                {rangeLabel}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNext}
                disabled={pending}
                title="Następny okres"
              >
                <IconChevronRight size={16} />
              </Button>
            </div>
            {pending ? (
              <span className="text-[11px] text-slate-400">Ładowanie…</span>
            ) : null}
          </div>
          {extendedSummary ? <UpcomingDeliverySummaryTiles summary={extendedSummary} /> : null}
          {pending && !extendedSummary ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : null}
        </div>

        {error ? (
          <div className={panelSectionInsetClass}>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : null}

        {!error && todayDay ? (
          <div className="border-b border-slate-100 px-3 py-3 sm:px-4">
            <DeliveryTodaySection todayDay={todayDay} pending={pending} />
          </div>
        ) : null}

        {!error && !pending && weekGridEmpty && days.length === 0 ? (
          <div className="px-3 py-3 sm:px-4">
            <EmptyState
              title="Brak zaplanowanych dostaw w wybranym okresie"
              description="Wybierz inny zakres dat lub sprawdź kolejkę przyjęcia towaru."
            />
          </div>
        ) : null}

        {!error && !weekGridEmpty ? (
          <div className="overflow-hidden border-t border-slate-100">
            <DeliveryWeekGrid days={weekDays} pending={pending} />
          </div>
        ) : null}

        {!error && pending && weekGridEmpty ? (
          <div className="px-3 py-3 sm:px-4">
            <div className="grid grid-cols-1 gap-px overflow-hidden bg-slate-100 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-32 animate-pulse bg-slate-100" />
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      <p className={cn(panelTypography.caption, "mt-3 text-center")}>
        Plan dostawców na podstawie harmonogramu · prognoza paczek i palet z historii dostaw.
      </p>
    </div>
  );
}
