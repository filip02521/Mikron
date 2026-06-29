"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { addDays } from "date-fns";
import { actionFetchUpcomingDeliveries } from "@/app/actions/upcoming-deliveries";
import type { UpcomingDeliveriesPayload } from "@/app/actions/upcoming-deliveries";
import {
  upcomingDeliveryPresetRange,
  type UpcomingDeliveryRangePreset,
} from "@/lib/data/upcoming-deliveries";
import { formatDateString } from "@/lib/orders/dates";
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
import { QUEUE_LIST_BODY_CLASS } from "@/lib/ui/queue-panel-styles";
import { UpcomingDeliverySummaryTiles } from "@/components/deliveries/UpcomingDeliverySummaryTiles";
import { UpcomingDeliveryDayCard } from "@/components/deliveries/UpcomingDeliveryDayCard";

const PRESET_OPTIONS: { value: UpcomingDeliveryRangePreset; label: string }[] = [
  { value: "week", label: "Tydzień" },
  { value: "7days", label: "7 dni" },
  { value: "14days", label: "14 dni" },
];

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
}: {
  initialPayload: UpcomingDeliveriesPayload | null;
  loadError: string | null;
  isAuthorized: boolean;
}) {
  const [payload, setPayload] = useState<UpcomingDeliveriesPayload | null>(initialPayload);
  const [error, setError] = useState<string | null>(loadError);
  const [preset, setPreset] = useState<UpcomingDeliveryRangePreset | "custom">("week");
  const [dateFrom, setDateFrom] = useState(initialPayload?.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(initialPayload?.dateTo ?? "");
  const [pending, start] = useTransition();

  const loadData = useCallback(
    (from: string, to: string) => {
      start(async () => {
        try {
          const next = await actionFetchUpcomingDeliveries(from, to);
          setPayload(next);
          setDateFrom(next.dateFrom);
          setDateTo(next.dateTo);
          setError(null);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Błąd ładowania dostaw.");
        }
      });
    },
    []
  );

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

  const days = payload?.days ?? [];
  const summary = payload?.summary;
  const rangeLabel = useMemo(() => {
    if (!dateFrom || !dateTo) return "";
    return formatRangeLabel(dateFrom, dateTo);
  }, [dateFrom, dateTo]);

  if (!isAuthorized) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Card>
          <EmptyState
            title="Brak uprawnień"
            description="Panel nadchodzących dostaw jest dostępny dla działu magazynu."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Card padding={false} className="overflow-hidden">
        <CardHeader
          title="Nadchodzące dostawy"
          description="Terminy realizacji z dokumentów ZD w Subiekcie"
          hint="Zamówienia z przypisanym terminem realizacji ZD, pogrupowane wg daty i dostawcy."
          density="compact"
          inset
          leading={
            <SectionHeadingIcon tileClassName={sectionIconTileBrandClass} className="h-7 w-7">
              <IconTruck size={16} />
            </SectionHeadingIcon>
          }
          action={
            <SegmentedControl
              value={preset === "custom" ? ("" as UpcomingDeliveryRangePreset) : preset}
              onChange={handlePresetChange}
              options={PRESET_OPTIONS}
              ariaLabel="Zakres czasowy dostaw"
            />
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
          {summary ? <UpcomingDeliverySummaryTiles summary={summary} /> : null}
        </div>

        {error ? (
          <div className={panelSectionInsetClass}>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : null}

        {!error && !pending && days.length === 0 ? (
          <EmptyState
            title="Brak zaplanowanych dostaw w wybranym okresie"
            description="Wybierz inny zakres dat lub sprawdź kolejkę przyjęcia towaru."
          />
        ) : null}

        {!error && days.length > 0 ? (
          <div className={cn(QUEUE_LIST_BODY_CLASS, "space-y-3 p-3 sm:p-4")}>
            {days.map((day) => (
              <UpcomingDeliveryDayCard key={day.dateKey} day={day} />
            ))}
          </div>
        ) : null}

        {!error && pending && days.length === 0 ? (
          <div className={panelSectionInsetClass}>
            <p className="text-sm text-slate-400">Ładowanie dostaw…</p>
          </div>
        ) : null}
      </Card>

      <p className={cn(panelTypography.caption, "mt-3 text-center")}>
        Prognoza paczek i palet na podstawie historii dostaw od danego dostawcy.
      </p>
    </div>
  );
}
