"use client";

import {
  collectNotepadTodayTasks,
  type NotepadTodayTaskKind,
} from "@/lib/sales/notepad-today-tasks";
import type { SalesNote, SalesZkWatch } from "@/types/database";
import { Badge } from "@/components/ui/Badge";
import { formatProsbaZkLinkNumber } from "@/lib/orders/zk-prosba-link-display";
import { ZK_PAGE_SECTION_COPY } from "@/lib/sales/zk-page-copy";
import { surfaceCardClass, salesChromeInsetClass, salesTypography } from "@/lib/ui/ontime-theme";
import { LinkChevron } from "@/components/ui/UiGlyphs";
import { cn } from "@/lib/cn";

function taskBadge(kind: NotepadTodayTaskKind) {
  switch (kind) {
    case "zk-follow-up":
      return (
        <Badge variant="info" className="text-[0.625rem]">
          Przypomnienie
        </Badge>
      );
    case "zk-warehouse-arrival":
      return (
        <Badge variant="info" className="text-[0.625rem]">
          Nowy na regale
        </Badge>
      );
    case "note-follow-up":
      return (
        <Badge variant="info" className="text-[0.625rem]">
          Notatka
        </Badge>
      );
  }
}

function TodayTaskList({
  tasks,
  onTaskClick,
}: {
  tasks: ReturnType<typeof collectNotepadTodayTasks>;
  onTaskClick?: (anchor: string, kind: NotepadTodayTaskKind) => void;
}) {
  function navigate(anchor: string, kind: NotepadTodayTaskKind) {
    if (onTaskClick) {
      onTaskClick(anchor, kind);
      return;
    }
    document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {tasks.map((task) => (
        <li key={`${task.kind}-${task.id}`}>
          <button
            type="button"
            onClick={() => navigate(task.anchor, task.kind)}
            className="flex w-full items-center justify-between gap-2 rounded-md border border-slate-200/80 bg-white px-2.5 py-1.5 text-left transition-colors hover:border-slate-300 hover:bg-slate-50 active:scale-[0.99]"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {taskBadge(task.kind)}
                {task.kind === "zk-follow-up" || task.kind === "zk-warehouse-arrival" ? (
                  <span className="truncate text-xs font-semibold tabular-nums text-slate-800">
                    {formatProsbaZkLinkNumber(task.title)}
                  </span>
                ) : (
                  <span className="truncate text-xs font-semibold text-slate-900">{task.title}</span>
                )}
              </div>
              {task.subtitle ? (
                <p className="mt-0.5 truncate text-[0.6875rem] text-slate-500">{task.subtitle}</p>
              ) : null}
            </div>
            <LinkChevron size={14} tone="brand" />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function TodayTasksSection({
  watches,
  notes,
  onTaskClick,
  embedded = false,
  unseenWarehouseWatchIds,
  inStockCountByWatchId,
  kinds,
  showTopDivider = false,
}: {
  watches: SalesZkWatch[];
  notes: SalesNote[];
  onTaskClick?: (anchor: string, kind: NotepadTodayTaskKind) => void;
  embedded?: boolean;
  unseenWarehouseWatchIds?: Set<string>;
  inStockCountByWatchId?: Record<string, number | string[]>;
  kinds?: NotepadTodayTaskKind[];
  showTopDivider?: boolean;
}) {
  const tasks = collectNotepadTodayTasks(watches, notes, {
    unseenWarehouseWatchIds,
    inStockCountByWatchId,
  }).filter((task) => !kinds?.length || kinds.includes(task.kind));
  if (!tasks.length) return null;

  const taskSummary = `${tasks.length} ${
    tasks.length === 1 ? "rzecz wymaga uwagi" : "rzeczy wymaga uwagi"
  }`;

  if (embedded) {
    return (
      <div
        className={cn(
          "border-b border-slate-200/80 bg-slate-50/40",
          showTopDivider && "border-t border-slate-200/80",
          salesChromeInsetClass,
          "space-y-2 py-2.5"
        )}
      >
        <p className="text-xs font-medium text-slate-600">
          <span className="font-semibold text-slate-900">
            {ZK_PAGE_SECTION_COPY.todayTasksTitle}
          </span>
          <span className="text-slate-400"> · </span>
          <span className="tabular-nums text-slate-500">{taskSummary}</span>
        </p>
        <TodayTaskList tasks={tasks} onTaskClick={onTaskClick} />
      </div>
    );
  }

  return (
    <section className={cn(surfaceCardClass, "border-slate-200/90 bg-white p-3 sm:p-4")}>
      <div className="mb-2">
        <h2 className={salesTypography.blockTitle}>Do zrobienia dziś</h2>
        <p className={salesTypography.sectionHint}>{taskSummary}</p>
      </div>
      <TodayTaskList tasks={tasks} onTaskClick={onTaskClick} />
    </section>
  );
}
