"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
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
import { Badge } from "@/components/ui/Badge";
import { HelpPopover } from "@/components/ui/HelpPopover";
import { HelpBlock } from "@/components/ui/HelpBlock";
import { cn } from "@/lib/cn";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateString, parseDateOnly } from "@/lib/orders/dates";
import { todayInWarsaw } from "@/lib/time/warsaw";
import {
  urgentCardClassName,
  urgentStatusBadgeVariant,
} from "@/components/summary/urgent-card-styles";
import { DailySectionIcon, IconGripVertical } from "@/components/icons/StrokeIcons";
import {
  plannerDropActiveClass,
  plannerDropHintClass,
  plannerModeBannerClass,
  plannerModeTextClass,
  plannerHintMutedClass,
  plannerHintMutedFaintClass,
  panelNameLinkClass,
  panelTypography,
  rowPendingRingClass,
  surfaceCardClass,
  weekPlannerEmptyHeaderGridClass,
  weekPlannerGridClass,
} from "@/lib/ui/ontime-theme";
import { locationLabel } from "@/lib/display-labels";
import {
  DailyPanelSubsectionBar,
  dailyPanelQueueShellClass,
} from "@/components/summary/DailyPanelSubsectionBar";
import { dailyPanelTabScrollClass } from "@/lib/orders/daily-panel-section-anchors";
import { FlowChevron } from "@/components/ui/UiGlyphs";
import { panelRowClearFocusOnLeave, panelRowGroupClass } from "@/lib/ui/panel-row-actions-reveal";
import {
  weekPlannerCardActionsClass,
  weekPlannerCardLayoutClass,
} from "@/lib/ui/surfaces";

function PlanSectionHelp({ planning }: { planning: boolean }) {
  return (
    <HelpPopover label="Pomoc — plan tygodnia" title="Plan tygodnia" shortLabel="Pomoc">
      {planning ? (
        <HelpBlock title="Tryb planowania">
          <ul className="list-disc space-y-1.5 pl-4">
            <li>Przeciągnij karty między dniami tygodnia.</li>
            <li>
              <strong className="font-medium text-slate-800">Zatwierdź plan</strong> zapisuje
              przesunięcia w harmonogramie — z uwzględnieniem urlopów i przeliczenia terminów.
            </li>
          </ul>
        </HelpBlock>
      ) : (
        <>
          <HelpBlock title="Co tu jest">
            <p>Karty dostawców z przyszłymi terminami zamówień.</p>
          </HelpBlock>
          <HelpBlock title="Działania">
            <ul className="list-disc space-y-1.5 pl-4">
              <li>
                Oznacz <strong className="font-medium text-slate-800">Zamówione</strong>, gdy
                złożysz zamówienie wcześniej u dostawcy.
              </li>
              <li>
                Włącz <strong className="font-medium text-slate-800">tryb planowania</strong>, aby
                rozłożyć zamówienia na tydzień metodą przeciągnij i upuść.
              </li>
            </ul>
          </HelpBlock>
        </>
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
  emptyContext,
  density = "default",
  chrome = "card",
  sectionId,
  todayDateKey,
}: {
  title: string;
  description?: string;
  days: WeekDayPlan[];
  /** Klucz „dziś” z workspace (Warszawa) — spójny SSR z badge Zaległe. */
  todayDateKey?: string;
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
  /** Kompaktowa typografia i nagłówki — wąska kolumna (sales / plan). */
  density?: "default" | "compact";
  /** Gdy tydzień pusty — kontekst do wyśrodkowanego komunikatu w siatce kalendarza. */
  emptyContext?: {
    onDemandCount?: number;
    onOpenOnDemand?: () => void;
  };
  /** Obudowa: karta (domyślnie) lub sekcja panelu Dziś/Tydzień. */
  chrome?: "card" | "dailyPanel";
  /** Kotwica scrolla (np. plan-ten-tydzien). */
  sectionId?: string;
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
  const resolvedTodayKey = todayDateKey ?? formatDateString(todayInWarsaw());
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
      {
        scope: DAILY_PANEL_SCOPE_PLAN,
        onSuccess: () => {
          setPlanningMode(false);
          setDraftDays(null);
          setOriginalPlacement(null);
        },
      }
    );
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
      variant={planningMode ? "primary" : chrome === "dailyPanel" ? "ghost" : "outline"}
      disabled={isPlanPending}
      className={cn(
        chrome === "dailyPanel"
          ? "h-8 px-2 text-xs"
          : "h-11 min-h-11 w-full sm:h-9 sm:min-h-9 sm:w-auto"
      )}
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
    <WeekPlanEmptyCalendar
      days={displayDays}
      emptyContext={emptyContext}
      density={density}
    />
  ) : (
    <div className={weekPlannerGridClass}>
      {displayDays.map((day) => (
        <DayColumn
          key={day.dateKey}
          day={day}
          todayDateKey={resolvedTodayKey}
          density={density}
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
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isPlanPending}
              className="h-11 min-h-11 w-full sm:h-9 sm:min-h-9 sm:w-auto"
              onClick={cancelPlanning}
            >
              Anuluj
            </Button>
            <Button
              type="button"
              size="sm"
              variant="primary"
              disabled={isPlanPending || pendingChanges.length === 0}
              className="h-11 min-h-11 w-full sm:h-9 sm:min-h-9 sm:w-auto"
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
      <div className={cn(total > 0 && "overflow-hidden", surfaceCardClass)}>
        {planningBar}
        {grid}
      </div>
    );
  }

  const headerActions = (
    <div className="flex w-full flex-col items-stretch gap-1 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
      {canOrder ? <PlanSectionHelp planning={planningMode} /> : null}
      {planningToggle}
      {headerAction}
    </div>
  );

  const sectionHeader =
    chrome === "dailyPanel" ? (
      <DailyPanelSubsectionBar
        title={title}
        description={description ?? "Poniedziałek–piątek · zamówienia z wyprzedzeniem"}
        tone="plan"
        count={total > 0 ? total : undefined}
        countUnit={{ one: "pozycja", few: "pozycje", many: "pozycji" }}
        action={headerActions}
      />
    ) : (
      <CardHeader
        inset
        density={density === "compact" ? "compact" : "default"}
        title={title}
        description={description ?? `${total} pozycji`}
        action={headerActions}
      />
    );

  if (chrome === "dailyPanel") {
    return (
      <section
        id={sectionId}
        className={cn(
          dailyPanelQueueShellClass(),
          dailyPanelTabScrollClass,
          total > 0 && "overflow-x-clip"
        )}
      >
        {sectionHeader}
        {planningBar}
        {grid}
      </section>
    );
  }

  return (
    <Card padding={false} className={cn(total > 0 && "overflow-x-clip")}>
      {sectionHeader}
      {planningBar}
      {grid}
    </Card>
  );
}

function WeekPlanEmptyCalendar({
  days,
  emptyContext,
  density = "default",
}: {
  days: WeekDayPlan[];
  emptyContext?: {
    onDemandCount?: number;
    onOpenOnDemand?: () => void;
  };
  density?: "default" | "compact";
}) {
  const onDemandCount = emptyContext?.onDemandCount ?? 0;
  const onOpenOnDemand = emptyContext?.onOpenOnDemand;

  const onDemandLine =
    onDemandCount > 0
      ? `${onDemandCount} ${
          onDemandCount === 1 ? "dostawca na żądanie" : "dostawców na żądanie"
        } — bez stałego terminu w harmonogramie.`
      : null;

  return (
    <div className="border-t border-slate-100">
      <div className={weekPlannerEmptyHeaderGridClass}>
        {days.map((day) => (
          <div
            key={day.dateKey}
            className={cn("px-3 py-3 text-center", day.isToday && "bg-sky-50/40", density === "compact" && "px-2 py-2")}
          >
            <p
              className={cn(
                "font-semibold uppercase tracking-wider",
                density === "compact" ? "text-[10px]" : "text-[10px]",
                day.isToday ? "text-slate-800" : "text-slate-500"
              )}
            >
              {day.weekdayLabel}
            </p>
            <p className={cn("mt-0.5 font-semibold text-slate-900", density === "compact" ? "text-xs" : "text-sm")}>
              {day.dateLabel}
            </p>
            {day.isToday ? (
              <Badge variant="info" className="mt-1.5 px-2 py-0 text-[9px] uppercase">
                Dziś
              </Badge>
            ) : null}
          </div>
        ))}
      </div>
      <div className="bg-slate-50/35">
        <EmptyState
          brandAccent
          icon={<DailySectionIcon kind="plan" size={28} />}
          title="Brak zaplanowanych zamówień w tym tygodniu"
          description={
            [
              "Harmonogram na najbliższe dni robocze jest pusty. Gdy coś się pojawi, zobaczysz to na kartach dostawców poniżej.",
              onDemandLine,
            ]
              .filter(Boolean)
              .join(" ")
          }
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link href="/lokalizacje/POLSKA">
                <Button size="sm" variant="secondary">
                  Terminy zamówień
                </Button>
              </Link>
              {onDemandCount > 0 && onOpenOnDemand ? (
                <Button size="sm" variant="outline" onClick={onOpenOnDemand}>
                  Na żądanie ({onDemandCount})
                </Button>
              ) : null}
            </div>
          }
        />
      </div>
    </div>
  );
}

function DayColumn({
  day,
  todayDateKey,
  density = "default",
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
  todayDateKey: string;
  density?: "default" | "compact";
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
        "flex flex-col transition-colors",
        density === "compact" ? "min-h-[7.5rem]" : "min-h-[140px]",
        day.isToday && "bg-sky-50/35",
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
          "flex items-start justify-between gap-2 border-b border-slate-100",
          density === "compact" ? "px-2 py-2" : "px-3 py-2.5",
          day.isToday && "border-sky-200/80 bg-sky-50/55"
        )}
      >
        <div>
          <p
            className={cn(
              "font-semibold uppercase tracking-wider",
              density === "compact" ? "text-[10px]" : "text-xs",
              day.isToday ? "text-slate-800" : "text-slate-500"
            )}
          >
            {day.weekdayLabel}
          </p>
          <p className={cn("font-semibold text-slate-900", density === "compact" ? "text-xs" : "text-sm")}>
            {day.dateLabel}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {day.isToday ? (
            <Badge variant="info" className="px-2 py-0 text-[10px] uppercase">
              Dziś
            </Badge>
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
              todayDateKey={todayDateKey}
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
  todayDateKey,
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
  todayDateKey: string;
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
  const isOverdue = formatDateString(item.nextDate) < todayDateKey;
  const rowPending = isScopePending(item.supplierId) || isPlanPending;

  const movedLabel = useMemo(() => {
    if (!isMoved) return null;
    const d = parseDateOnly(dayDateKey);
    return d ? formatDateString(d, "dd.MM") : dayDateKey;
  }, [isMoved, dayDateKey]);

  const supplierTitle = onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      className={cn(panelTypography.rowTitle, panelNameLinkClass, "text-left")}
    >
      {item.supplierName}
    </button>
  ) : (
    <span className={cn(panelTypography.rowTitle, "text-slate-900")}>{item.supplierName}</span>
  );

  const mainContent = (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {supplierTitle}
        {isOverdue && !isMoved ? (
          <Badge variant={urgentStatusBadgeVariant(true)} className="text-[10px]">
            Zaległe
          </Badge>
        ) : null}
      </div>
      <p className={cn("mt-0.5", panelTypography.rowMeta)}>
        {locationLabel(item.location)}
        {note ? (
          <>
            {" · "}
            <span className="line-clamp-2">{note}</span>
          </>
        ) : null}
      </p>
      {isMoved && movedLabel ? (
        <p className="mt-0.5 inline-flex flex-wrap items-center gap-1 text-[10px] font-medium text-amber-800">
          Przeniesiono
          <FlowChevron size={10} className="text-amber-500/80" />
          {movedLabel}
        </p>
      ) : null}
    </>
  );

  const scheduleActions =
    canOrder && run && onVacation && onEdit ? (
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
    ) : null;

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
          panelRowGroupClass("text-sm transition"),
          urgentCardClassName(isOverdue && !isMoved),
          isMoved && "border-slate-200 border-l-2 border-l-amber-400 bg-white",
          isDragging && "opacity-50",
          rowPending && rowPendingRingClass
        )}
        aria-busy={rowPending}
        onMouseLeave={panelRowClearFocusOnLeave}
      >
        {planningMode ? (
          <div className="flex items-start gap-1 px-2 py-1.5">
            <span
              className="mt-0.5 cursor-grab text-slate-400 active:cursor-grabbing"
              title="Przeciągnij"
            >
              <IconGripVertical size={16} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">{mainContent}</div>
          </div>
        ) : (
          <div className={cn("px-2 py-2", weekPlannerCardLayoutClass)}>
            <div className="min-w-0 flex-1">{mainContent}</div>
            {scheduleActions ? (
              <div className={weekPlannerCardActionsClass}>{scheduleActions}</div>
            ) : null}
          </div>
        )}
      </article>
    </li>
  );
}
