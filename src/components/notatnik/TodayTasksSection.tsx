"use client";

import {
  collectNotepadTodayTasks,
  type NotepadTodayTaskKind,
} from "@/lib/sales/notepad-today-tasks";
import type { SalesNote, SalesPaymentWatch } from "@/types/database";
import { Badge } from "@/components/ui/Badge";
import { surfaceCardClass } from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";

function taskBadge(kind: NotepadTodayTaskKind) {
  switch (kind) {
    case "zk-overdue":
      return (
        <Badge variant="danger" className="text-[10px]">
          ZK po terminie
        </Badge>
      );
    case "zk-follow-up":
      return (
        <Badge variant="purple" className="text-[10px]">
          ZK · follow-up
        </Badge>
      );
    case "note-follow-up":
      return (
        <Badge variant="purple" className="text-[10px]">
          Notatka
        </Badge>
      );
  }
}

export function TodayTasksSection({
  watches,
  notes,
  onTaskClick,
}: {
  watches: SalesPaymentWatch[];
  notes: SalesNote[];
  onTaskClick?: (anchor: string, kind: NotepadTodayTaskKind) => void;
}) {
  const tasks = collectNotepadTodayTasks(watches, notes);
  if (!tasks.length) return null;

  function navigate(anchor: string, kind: NotepadTodayTaskKind) {
    if (onTaskClick) {
      onTaskClick(anchor, kind);
      return;
    }
    document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <section className={cn(surfaceCardClass, "border-violet-200/80 bg-violet-50/40 p-3 sm:p-4")}>
      <div className="mb-2">
        <h2 className="text-sm font-semibold text-slate-900">Do zrobienia dziś</h2>
        <p className="text-xs text-slate-600">
          {tasks.length}{" "}
          {tasks.length === 1 ? "rzecz wymaga uwagi" : "rzeczy wymaga uwagi"}
        </p>
      </div>
      <ul className="flex flex-col gap-1.5">
        {tasks.map((task) => (
          <li key={`${task.kind}-${task.id}`}>
            <button
              type="button"
              onClick={() => navigate(task.anchor, task.kind)}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/80 bg-white/90 px-3 py-2 text-left shadow-sm transition hover:border-violet-200 hover:bg-white"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {taskBadge(task.kind)}
                  <span className="truncate text-xs font-semibold text-slate-900">{task.title}</span>
                </div>
                {task.subtitle ? (
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">{task.subtitle}</p>
                ) : null}
              </div>
              <span className="shrink-0 text-[11px] font-medium text-indigo-700">→</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
