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
  collectOverdueDeliveries,
} from "@/lib/data/upcoming-deliveries-shared";
import { formatDateString } from "@/lib/orders/dates";
import { useLatest } from "@/hooks/useLatest";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Button } from "@/components/ui/Button";
import { IconChevronLeft, IconChevronRight } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { adminPageShellClass, panelTypography } from "@/lib/ui/ontime-theme";
import { DeliveryTodaySection } from "@/components/deliveries/DeliveryTodaySection";
import { DeliveryOverdueSection } from "@/components/deliveries/DeliveryOverdueSection";
import { DeliveryWeekGrid } from "@/components/deliveries/DeliveryWeekGrid";
import type { SupplierWithSchedule } from "@/types/database";
import { BrandLoader } from "@/components/ui/BrandLoader";

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
  return `${from} - ${to}`;
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
  const overdueDeliveries = useMemo(() => collectOverdueDeliveries(days, todayDateKey), [days, todayDateKey]);
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
      <div className={adminPageShellClass}>
        <PageHeader title="Plan dostaw" />
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
    <div className={adminPageShellClass}>
      <PageHeader
        title="Plan dostaw"
        description="Planowi dostawcy z harmonogramu i dokumenty ZD z Subiekta. Plan odświeża się sam."
        actions={
          <Button variant="secondary" size="sm" onClick={refreshQuiet} disabled={pending || !dateFrom || !dateTo}>
            Odśwież
          </Button>
        }
        className="mb-0"
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <SegmentedControl
          value={preset === "custom" ? ("" as UpcomingDeliveryRangePreset) : preset}
          onChange={handlePresetChange}
          options={PRESET_OPTIONS}
          ariaLabel="Zakres czasowy dostaw"
          touchFriendly
        />
        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            className="min-h-11 min-w-11 sm:min-h-8 sm:min-w-8"
            onClick={handlePrev}
            disabled={pending}
            aria-label="Poprzedni okres"
            title="Poprzedni okres"
          >
            <IconChevronLeft size={16} aria-hidden />
          </Button>
          <span className="px-1 text-sm font-medium tabular-nums text-slate-700">{rangeLabel}</span>
          <Button
            variant="secondary"
            size="sm"
            className="min-h-11 min-w-11 sm:min-h-8 sm:min-w-8"
            onClick={handleNext}
            disabled={pending}
            aria-label="Następny okres"
            title="Następny okres"
          >
            <IconChevronRight size={16} aria-hidden />
          </Button>
        </div>
        {pending ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500" role="status">
            <BrandLoader size="sm" tile={false} /> Wczytuję dostawy…
          </span>
        ) : extendedSummary ? (
          <p className="text-[0.6875rem] tabular-nums text-slate-500 sm:ml-auto">
            {extendedSummary.positionCount}{" "}
            {polishPluralWord(extendedSummary.positionCount, "pozycja", "pozycje", "pozycji")} w ZD · prognoza ok.{" "}
            {extendedSummary.estimatedPackages}{" "}
            {polishPluralWord(extendedSummary.estimatedPackages, "paczki", "paczek", "paczek")} i{" "}
            {extendedSummary.estimatedPallets}{" "}
            {polishPluralWord(extendedSummary.estimatedPallets, "palety", "palet", "palet")} ·{" "}
            {extendedSummary.scheduledSupplierCount}{" "}
            {polishPluralWord(extendedSummary.scheduledSupplierCount, "dostawca", "dostawcy", "dostawców")} z planu
          </p>
        ) : null}
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {!error && todayDay ? <DeliveryTodaySection todayDay={todayDay} pending={pending} /> : null}

      {!error ? <DeliveryOverdueSection items={overdueDeliveries} /> : null}

      {!error && !pending && weekGridEmpty && days.length === 0 ? (
        <Card>
          <EmptyState
            title="Brak zaplanowanych dostaw w wybranym okresie"
            description="Wybierz inny zakres dat lub sprawdź kolejkę przyjęcia towaru."
          />
        </Card>
      ) : null}

      {!error && !weekGridEmpty ? (
        <Card padding={false} className="overflow-hidden">
          <DeliveryWeekGrid days={weekDays} pending={pending} />
        </Card>
      ) : null}

      {!error && pending && weekGridEmpty ? (
        <Card>
          <div role="status" className="flex flex-col items-center justify-center gap-3 py-8 text-sm text-slate-600">
            <BrandLoader size="lg" tile={false} />
            Wczytuję plan dostaw. Zwykle trwa to kilka sekund.
          </div>
        </Card>
      ) : null}

      <p className={cn(panelTypography.caption, "text-center")}>
        Plan dostawców na podstawie harmonogramu · prognoza paczek i palet z historii dostaw.
      </p>
    </div>
  );
}
