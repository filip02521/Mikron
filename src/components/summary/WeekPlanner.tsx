"use client";

import { useCallback, useMemo, useState } from "react";
import type { WeekDayPlan } from "@/lib/orders/summary-workspace";
import type { SummaryStandardItem } from "@/lib/orders/summary";
import { formatPlannerNote } from "@/lib/orders/procurement-daily-ui";
import { actionBatchShiftOrder, actionMarkOrdered } from "@/app/actions/admin";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";
import {
  buildPlacementMap,
  canDropOnDay,
  cloneWeekDays,
  collectPlanShiftChanges,
  movePlannerItem,
} from "@/lib/orders/week-planner-draft";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ButtonGroup } from "@/components/ui/ButtonGroup";
import { HoldToConfirmButton } from "@/components/ui/HoldToConfirmButton";
import { HelpPopover } from "@/components/ui/HelpPopover";
import { buttonGroupItemClassName } from "@/components/ui/ButtonGroup";
import { cn } from "@/lib/cn";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateString, parseDateOnly } from "@/lib/orders/dates";
import { todayInWarsaw } from "@/lib/time/warsaw";
import { urgentCardClassName } from "@/components/summary/urgent-card-styles";

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
  readOnly = false,
  headerAction,
  run,
  pending = false,
}: {
  title: string;
  description?: string;
  days: WeekDayPlan[];
  onOpenSupplier?: (supplierId: string) => void;
  readOnly?: boolean;
  headerAction?: React.ReactNode;
  run?: DailyPanelRunFn;
  pending?: boolean;
}) {
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
      "Zapisywanie planu tygodnia…"
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
      disabled={pending}
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

      {planningMode ? (
        <div className="border-b border-indigo-200/80 bg-indigo-50/60 px-4 py-3 sm:px-5">
          <p className="text-sm text-indigo-950">
            Przeciągnij dostawców na wybrany dzień. Terminy w bazie zmienią się dopiero po{" "}
            <span className="font-semibold">Zatwierdź plan</span> (przeliczenie jak przy ręcznym
            przesunięciu).
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={cancelPlanning}
            >
              Anuluj
            </Button>
            <Button
              type="button"
              size="sm"
              variant="primary"
              disabled={pending || pendingChanges.length === 0}
              onClick={confirmPlanning}
            >
              Zatwierdź plan
              {pendingChanges.length > 0 ? ` (${pendingChanges.length})` : ""}
            </Button>
            {pendingChanges.length > 0 ? (
              <span className="text-xs text-indigo-800/80">
                {pendingChanges.length === 1
                  ? "1 dostawca zmieni termin"
                  : `${pendingChanges.length} dostawców zmieni termin`}
              </span>
            ) : (
              <span className="text-xs text-indigo-800/60">Brak zmian do zapisania</span>
            )}
          </div>
        </div>
      ) : null}

      {!total ? (
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
              pending={pending}
              onDragOverColumn={(key) => setDropTargetKey(key)}
              onDragLeaveColumn={() => setDropTargetKey(null)}
              onDropOnColumn={handleDrop}
              onDragStartItem={setDraggingId}
              onDragEndItem={() => setDraggingId(null)}
            />
          ))}
        </div>
      )}
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
  pending,
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
  pending: boolean;
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
        dropActive && droppable && "bg-indigo-50/80 ring-2 ring-inset ring-indigo-300/50"
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
              droppable ? "rounded-lg border border-dashed border-indigo-200 text-indigo-400" : "text-slate-400"
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
              pending={pending}
              run={run}
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
  pending,
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
  pending: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const note = formatPlannerNote(item.notes);
  const todayStr = formatDateString(todayInWarsaw());
  const isOverdue = formatDateString(item.nextDate) < todayStr;

  const markOrdered = () => {
    if (!run) return;
    run(
      () => actionMarkOrdered(item.supplierId),
      `Zamówione · ${item.supplierName}`,
      "Oznaczanie jako zamówione…"
    );
  };

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
            aria-hidden
            title="Przeciągnij"
          >
            ⠿
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
        draggable={planningMode && !pending}
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
          "overflow-hidden text-sm transition",
          urgentCardClassName(isOverdue && !isMoved),
          isMoved && "border-amber-300/90 bg-white ring-1 ring-amber-200/80",
          isDragging && "opacity-50",
          !planningMode && !isOverdue && "hover:border-slate-300",
          !planningMode && isOverdue && !isMoved && "hover:border-rose-300/90"
        )}
      >
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            className="w-full cursor-pointer px-2.5 py-2 text-left transition hover:bg-slate-50/80"
          >
            {body}
          </button>
        ) : (
          <div className="px-2.5 py-2">{body}</div>
        )}
        {canOrder && run ? (
          <div className="flex border-t border-slate-100 bg-slate-50/50">
            <ButtonGroup
              ariaLabel={`Zamówione — ${item.supplierName}`}
              className="min-w-0 flex-1 rounded-none border-0 shadow-none"
            >
              <HoldToConfirmButton
                label="Zamówione"
                variant="primary"
                disabled={pending}
                className={buttonGroupItemClassName("h-8 flex-1 text-xs")}
                onConfirm={markOrdered}
              />
              {onOpen ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  className={buttonGroupItemClassName(
                    "h-8 flex-1 border-l border-slate-100 text-xs text-slate-600"
                  )}
                  onClick={onOpen}
                >
                  Szczegóły
                </Button>
              ) : null}
            </ButtonGroup>
          </div>
        ) : null}
      </article>
    </li>
  );
}
