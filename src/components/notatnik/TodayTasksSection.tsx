"use client";

import { collectNotepadTodayTasks } from "@/lib/sales/notepad-today-tasks";
import type { SalesNote, SalesPaymentWatch } from "@/types/database";
import { Badge } from "@/components/ui/Badge";

function taskBadge(kind: ReturnType<typeof collectNotepadTodayTasks>[number]["kind"]) {
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
}: {
  watches: SalesPaymentWatch[];
  notes: SalesNote[];
}) {
  const tasks = collectNotepadTodayTasks(watches, notes);
  if (!tasks.length) return null;

  function scrollTo(anchor: string) {
    document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <section className="rounded-xl border border-violet-200/90 bg-violet-50/50 p-4 sm:p-5">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-slate-900">Do zrobienia dziś</h2>
        <p className="mt-1 text-sm text-slate-600">
          {tasks.length}{" "}
          {tasks.length === 1 ? "rzecz wymaga uwagi" : tasks.length < 5 ? "rzeczy wymagają uwagi" : "rzeczy wymaga uwagi"}
          — ZK po terminie i przypomnienia.
        </p>
      </div>
      <ul className="space-y-2">
        {tasks.map((task) => (
          <li key={`${task.kind}-${task.id}`}>
            <button
              type="button"
              onClick={() => scrollTo(task.anchor)}
              className="flex w-full flex-col gap-1 rounded-lg border border-white/80 bg-white/90 px-3 py-2.5 text-left shadow-sm transition hover:border-violet-200 hover:bg-white sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  {taskBadge(task.kind)}
                  <span className="text-sm font-semibold text-slate-900">{task.title}</span>
                </div>
                {task.subtitle ? (
                  <p className="text-xs leading-relaxed text-slate-600">{task.subtitle}</p>
                ) : null}
              </div>
              <span className="shrink-0 text-xs font-medium text-indigo-700">Pokaż →</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
