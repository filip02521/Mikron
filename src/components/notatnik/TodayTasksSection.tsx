"use client";

import {
  collectNotepadTodayTasks,
  type NotepadTodayTaskKind,
} from "@/lib/sales/notepad-today-tasks";
import type { SalesNote, SalesZkWatch } from "@/types/database";
import { Badge } from "@/components/ui/Badge";
import { surfaceCardClass } from "@/lib/ui/ontime-theme";
import { LinkChevron } from "@/components/ui/UiGlyphs";
import { cn } from "@/lib/cn";

function taskBadge(kind: NotepadTodayTaskKind) {
  switch (kind) {
    case "zk-follow-up":
      return (
        <Badge variant="purple" className="text-[10px]">
          ZK · przypomnienie
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
  embedded = false,
}: {
  watches: SalesZkWatch[];
  notes: SalesNote[];
  onTaskClick?: (anchor: string, kind: NotepadTodayTaskKind) => void;
  /** Wewnątrz głównej karty — bez osobnego „kartonu”. */
  embedded?: boolean;
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

  const shellClass = embedded
    ? "border-b border-violet-100 bg-violet-50/60 px-3 py-3 sm:px-4"
    : cn(surfaceCardClass, "border-violet-200/80 bg-violet-50/40 p-3 sm:p-4");

  return (
    <section className={shellClass}>
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
              className="flex w-full items-center justify-between gap-2 rounded-md border border-white/80 bg-white/90 px-3 py-2 text-left shadow-sm transition hover:border-violet-200 hover:bg-white"
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
              <LinkChevron size={14} tone="brand" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
