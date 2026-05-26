"use client";

import { useCallback, useMemo, useState } from "react";
import type { WeekDayPlan } from "@/lib/orders/summary-workspace";
import type { SummaryStandardItem } from "@/lib/orders/summary";
import { formatPlannerNote } from "@/lib/orders/procurement-daily-ui";
import { actionBatchShiftOrder } from "@/app/actions/admin";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";
import { DAILY_PANEL_SCOPE_PLAN } from "@/components/summary/useDailyPanelRunner";
import { ScheduleSupplierActionBar } from "@/components/summary/ScheduleSupplierActionBar";
import {
  buildPlacementMap,
  canDropOnDay,
  cloneWeekDays,
  collectPlanShiftChanges,
  movePlannerItem,
} from "@/lib/orders/week-planner-draft";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { HelpPopover } from "@/components/ui/HelpPopover";
import { cn } from "@/lib/cn";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateString, parseDateOnly } from "@/lib/orders/dates";
import { todayInWarsaw } from "@/lib/time/warsaw";
import { urgentCardClassName } from "@/components/summary/urgent-card-styles";
import { IconGripVertical } from "@/components/icons/StrokeIcons";
import {
  plannerDropActiveClass,
  plannerDropHintClass,
  plannerModeBannerClass,
  plannerModeTextClass,
  plannerHintMutedClass,
  plannerHintMutedFaintClass,
  surfaceCardClass,
} from "@/lib/ui/ontime-theme";

function PlanSectionHelp({ planning }: { planning: boolean }) {
  return (
    <HelpPopover label="Pomoc plan tygodnia" title="Plan tygodnia" shortLabel="Pomoc">
      {planning ? (
        <p>
          <strong className="font-medium text-slate-800">Tryb planowania</strong> — przeciągnij
          karty między dniami. Dopiero <strong className="font-medium text-slate-800">Zatwierdź plan</strong>{" "}
          zapisze przesunięcia w harmonogramie (z uwzględnieniem urlopów i przeliczenia terminów).
        </p>
      ) : (
        <p>
          Karty z przyszłymi terminami — możesz{" "}
          <strong className="font-medium text-slate-800">oznaczyć zamówienie z wyprzedzeniem</strong>
          , gdy złożysz je wcześniej u dostawcy, albo włączyć{" "}
          <strong className="font-medium text-slate-800">tryb planowania</strong> i rozłożyć zamówienia
          na tydzień metodą przeciągnij i upuść.
        </p>
      )}
    </HelpPopover>
  );
}

export function WeekPlanner({
  title,
  description,
  days,
  onOpenSupplier,
  onVacation,
  onEdit,
  readOnly = false,
  headerAction,
  run,
  isScopePending,
  isPlanPending = false,
  embedded = false,
}: {
  title: string;
  description?: string;
  days: WeekDayPlan[];
  onOpenSupplier?: (supplierId: string) => void;
  onVacation?: (supplierId: string) => void;
  onEdit?: (supplierId: string) => void;
  readOnly?: boolean;
  headerAction?: React.ReactNode;
  run?: DailyPanelRunFn;
  isScopePending?: (supplierId: string) => boolean;
  isPlanPending?: boolean;
  /** Bez zewnętrznej karty — do osadzenia w większej sekcji (np. /plan handlowiec). */
  embedded?: boolean;
}) {
  const rowPending = (id: string) => isScopePending?.(id) ?? false;
  const canOrder = Boolean(run) && !readOnly;
  const [planningMode, setPlanningMode] = useState(false);
  const [draftDays, setDraftDays] = useState<WeekDayPlan[] | null>(null);
  const [originalPlacement, setOriginalPlacement] = useState<Map<string, string> | null>(
    null
  );
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const displayDays = planningMode && draftDays ? draftDays : days;
  const total = displayDays.reduce((n, d) => n + d.items.length, 0);

  const pendingChanges = useMemo(() => {
    if (!planningMode || !originalPlacement || !draftDays) return [];
    return collectPlanShiftChanges(originalPlacement, draftDays);
  }, [planningMode, originalPlacement, draftDays]);

  const startPlanning = useCallback(() => {
    setOriginalPlacement(buildPlacementMap(days));
    setDraftDays(cloneWeekDays(days));
    setPlanningMode(true);
  }, [days]);

  const cancelPlanning = useCallback(() => {
    setPlanningMode(false);
    setDraftDays(null);
    setOriginalPlacement(null);
    setDropTargetKey(null);
    setDraggingId(null);
  }, []);

  const confirmPlanning = useCallback(() => {
    if (!run || !pendingChanges.length) return;
    const payload = pendingChanges.map((c) => ({
      supplierId: c.supplierId,
      manualDateIso: c.manualDateIso,
    }));
    run(
      () => actionBatchShiftOrder(payload),
      `Plan zatwierdzony — ${pendingChanges.length} ${
        pendingChanges.length === 1 ? "przesunięcie" : "przesunięć"
      }`,
      "Zapisywanie planu tygodnia…",
      { scope: DAILY_PANEL_SCOPE_PLAN }
    );
    setPlanningMode(false);
    setDraftDays(null);
    setOriginalPlacement(null);
  }, [run, pendingChanges]);

  const handleDrop = useCallback(
    (supplierId: string, targetDateKey: string) => {
      setDraftDays((prev) => {
        if (!prev) return prev;
        return movePlannerItem(prev, supplierId, targetDateKey);
      });
      setDropTargetKey(null);
      setDraggingId(null);
    },
    []
  );

  const planningToggle = canOrder ? (
    <Button
      type="button"
      size="sm"
      variant={planningMode ? "primary" : "outline"}
      disabled={isPlanPending}
      onClick={() => {
        if (planningMode) {
          if (pendingChanges.length > 0) {
            const ok = window.confirm(
              "Masz niezapisane zmiany w planie. Wyjść z trybu planowania bez zatwierdzania?"
            );
            if (!ok) return;
          }
          cancelPlanning();
        } else {
          startPlanning();
        }
      }}
    >
      {planningMode ? "Wyjdź z planowania" : "Tryb planowania"}
    </Button>
  ) : null;

  const grid = !total ? (
    <EmptyState title="Brak zamówień w tym tygodniu" />
  ) : (
    <div className="grid gap-0 border-t border-slate-100 max-lg:divide-y lg:grid-cols-5 lg:divide-x lg:divide-slate-100">
      {displayDays.map((day) => (
        <DayColumn
          key={day.dateKey}
          day={day}
          planningMode={planningMode}
          originalPlacement={originalPlacement}
          dropActive={dropTargetKey === day.dateKey}
          draggingId={draggingId}
          onOpenSupplier={onOpenSupplier}
          canOrder={canOrder && !planningMode}
          run={run}
          isScopePending={rowPending}
          isPlanPending={isPlanPending}
          onVacation={onVacation}
          onEdit={onEdit}
          onDragOverColumn={(key) => setDropTargetKey(key)}
          onDragLeaveColumn={() => setDropTargetKey(null)}
          onDropOnColumn={handleDrop}
          onDragStartItem={setDraggingId}
          onDragEndItem={() => setDraggingId(null)}
        />
      ))}
    </div>
  );

  const planningBar = planningMode ? (
        <div className={plannerModeBannerClass}>
          <p className={plannerModeTextClass}>
            Przeciągnij dostawców na wybrany dzień. Terminy w bazie zmienią się dopiero po{" "}
            <span className="font-semibold">Zatwierdź plan</span> (przeliczenie jak przy ręcznym
            przesunięciu).
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isPlanPending}
              onClick={cancelPlanning}
            >
              Anuluj
            </Button>
            <Button
              type="button"
              size="sm"
              variant="primary"
              disabled={isPlanPending || pendingChanges.length === 0}
              onClick={confirmPlanning}
            >
              Zatwierdź plan
              {pendingChanges.length > 0 ? ` (${pendingChanges.length})` : ""}
            </Button>
            {pendingChanges.length > 0 ? (
              <span className={plannerHintMutedClass}>
                {pendingChanges.length === 1
                  ? "1 dostawca zmieni termin"
                  : `${pendingChanges.length} dostawców zmieni termin`}
              </span>
            ) : (
              <span className={plannerHintMutedFaintClass}>Brak zmian do zapisania</span>
            )}
          </div>
        </div>
      ) : null;

  if (embedded) {
    return (
      <div className={cn("overflow-hidden", surfaceCardClass)}>
        {planningBar}
        {grid}
      </div>
    );
  }

  return (
    <Card padding={false} className="overflow-hidden">
      <CardHeader
        inset
        title={title}
        description={description ?? `${total} pozycji`}
        action={
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            {canOrder ? <PlanSectionHelp planning={planningMode} /> : null}
            {planningToggle}
            {headerAction}
          </div>
        }
      />

      {planningBar}

      {grid}
    </Card>
  );
}

function DayColumn({
  day,
  planningMode,
  originalPlacement,
  dropActive,
  draggingId,
  onOpenSupplier,
  canOrder,
  run,
  isScopePending,
  isPlanPending,
  onVacation,
  onEdit,
  onDragOverColumn,
  onDragLeaveColumn,
  onDropOnColumn,
  onDragStartItem,
  onDragEndItem,
}: {
  day: WeekDayPlan;
  planningMode: boolean;
  originalPlacement: Map<string, string> | null;
  dropActive: boolean;
  draggingId: string | null;
  onOpenSupplier?: (supplierId: string) => void;
  canOrder: boolean;
  run?: DailyPanelRunFn;
  isScopePending: (supplierId: string) => boolean;
  isPlanPending: boolean;
  onVacation?: (supplierId: string) => void;
  onEdit?: (supplierId: string) => void;
  onDragOverColumn: (dateKey: string) => void;
  onDragLeaveColumn: () => void;
  onDropOnColumn: (supplierId: string, dateKey: string) => void;
  onDragStartItem: (supplierId: string) => void;
  onDragEndItem: () => void;
}) {
  const droppable = planningMode && canDropOnDay(day);

  return (
    <section
      className={cn(
        "flex min-h-[140px] flex-col transition-colors",
        day.isToday && "bg-slate-50",
        day.isPast && !day.isToday && "bg-slate-50/40",
        dropActive && droppable && plannerDropActiveClass
      )}
      onDragOver={
        droppable
          ? (e) => {
              e.preventDefault();
              onDragOverColumn(day.dateKey);
            }
          : undefined
      }
      onDragLeave={droppable ? onDragLeaveColumn : undefined}
      onDrop={
        droppable
          ? (e) => {
              e.preventDefault();
              const supplierId = e.dataTransfer.getData("text/supplier-id");
              if (supplierId) onDropOnColumn(supplierId, day.dateKey);
            }
          : undefined
      }
    >
      <header
        className={cn(
          "flex items-start justify-between gap-2 border-b border-slate-100 px-3 py-2.5",
          day.isToday && "border-slate-200 bg-slate-100/80"
        )}
      >
        <div>
          <p
            className={cn(
              "text-xs font-semibold uppercase tracking-wider",
              day.isToday ? "text-slate-800" : "text-slate-500"
            )}
          >
            {day.weekdayLabel}
          </p>
          <p className="text-sm font-semibold text-slate-900">{day.dateLabel}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {day.isToday ? (
            <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-700">
              Dziś
            </span>
          ) : null}
          {planningMode && !droppable ? (
            <span className="text-[10px] text-slate-400">Tylko odczyt</span>
          ) : null}
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
              day.items.length > 0
                ? "bg-slate-200/80 text-slate-700"
                : "text-slate-400"
            )}
          >
            {day.items.length}
          </span>
        </div>
      </header>
      <ul className="flex flex-1 flex-col gap-1.5 p-2">
        {!day.items.length ? (
          <li
            className={cn(
              "flex flex-1 items-center justify-center px-1 py-6 text-center text-xs",
              droppable ? plannerDropHintClass : "text-slate-400"
            )}
          >
            {droppable && dropActive ? "Upuść tutaj" : "Brak"}
          </li>
        ) : (
          day.items.map((item) => (
            <PlannerCard
              key={`${day.dateKey}-${item.supplierId}`}
              item={item}
              dayDateKey={day.dateKey}
              planningMode={planningMode}
              isMoved={
                Boolean(
                  originalPlacement &&
                    originalPlacement.get(item.supplierId) !== day.dateKey
                )
              }
              isDragging={draggingId === item.supplierId}
              canOrder={canOrder}
              isScopePending={isScopePending}
              isPlanPending={isPlanPending}
              run={run}
              onVacation={onVacation}
              onEdit={onEdit}
              onOpen={
                onOpenSupplier && !planningMode
                  ? () => onOpenSupplier(item.supplierId)
                  : undefined
              }
              onDragStart={() => onDragStartItem(item.supplierId)}
              onDragEnd={onDragEndItem}
            />
          ))
        )}
      </ul>
    </section>
  );
}

function PlannerCard({
  item,
  dayDateKey,
  planningMode,
  isMoved,
  isDragging,
  onOpen,
  canOrder,
  run,
  isScopePending,
  isPlanPending,
  onVacation,
  onEdit,
  onDragStart,
  onDragEnd,
}: {
  item: SummaryStandardItem;
  dayDateKey: string;
  planningMode: boolean;
  isMoved: boolean;
  isDragging: boolean;
  onOpen?: () => void;
  canOrder: boolean;
  run?: DailyPanelRunFn;
  isScopePending: (supplierId: string) => boolean;
  isPlanPending: boolean;
  onVacation?: (supplierId: string) => void;
  onEdit?: (supplierId: string) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const note = formatPlannerNote(item.notes);
  const todayStr = formatDateString(todayInWarsaw());
  const isOverdue = formatDateString(item.nextDate) < todayStr;
  const rowPending = isScopePending(item.supplierId) || isPlanPending;

  const movedLabel = useMemo(() => {
    if (!isMoved) return null;
    const d = parseDateOnly(dayDateKey);
    return d ? formatDateString(d, "dd.MM") : dayDateKey;
  }, [isMoved, dayDateKey]);

  const body = (
    <>
      <div className="flex items-start gap-1.5">
        {planningMode ? (
          <span
            className="mt-0.5 cursor-grab text-slate-400 active:cursor-grabbing"
            title="Przeciągnij"
          >
            <IconGripVertical size={16} aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <span className="block font-semibold leading-snug text-slate-900">
            {item.supplierName}
          </span>
          {note ? (
            <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-500">{note}</p>
          ) : null}
          {isMoved && movedLabel ? (
            <p className="mt-1 text-[10px] font-medium text-amber-800">
              Przeniesiono → {movedLabel}
            </p>
          ) : null}
        </div>
      </div>
    </>
  );

  return (
    <li>
      <article
        draggable={planningMode && !isPlanPending}
        onDragStart={
          planningMode
            ? (e) => {
                e.dataTransfer.setData("text/supplier-id", item.supplierId);
                e.dataTransfer.effectAllowed = "move";
                onDragStart();
              }
            : undefined
        }
        onDragEnd={planningMode ? onDragEnd : undefined}
        className={cn(
          "text-sm transition",
          urgentCardClassName(isOverdue && !isMoved),
          isMoved && "border-amber-300/90 bg-white ring-1 ring-amber-200/80",
          isDragging && "opacity-50"
        )}
      >
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            className="w-full cursor-pointer rounded-xl px-2.5 py-2 text-left transition hover:bg-indigo-50/35"
          >
            {body}
          </button>
        ) : (
          <div className="px-2.5 py-2">{body}</div>
        )}
        {canOrder && run && onVacation && onEdit ? (
          <div className="border-t border-slate-100/80 bg-slate-50/50 px-2 py-1.5">
            <ScheduleSupplierActionBar
              compact
              supplierId={item.supplierId}
              supplierName={item.supplierName}
              location={item.location}
              pending={rowPending}
              run={run}
              onOpenSupplier={onOpen}
              onVacation={() => onVacation(item.supplierId)}
              onEdit={() => onEdit(item.supplierId)}
            />
          </div>
        ) : null}
      </article>
    </li>
  );
}
