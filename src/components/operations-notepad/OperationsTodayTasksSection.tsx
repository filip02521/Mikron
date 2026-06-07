"use client";

import type { OperationsNote } from "@/types/database";
import { Badge } from "@/components/ui/Badge";
import { LinkChevron } from "@/components/ui/UiGlyphs";
import { formatFollowUpLabel } from "@/lib/sales/notepad-follow-up";
import { cn } from "@/lib/cn";

export function OperationsTodayTasksSection({
  notes,
  onTaskClick,
  embedded = false,
}: {
  notes: OperationsNote[];
  onTaskClick?: (noteId: string) => void;
  /** Wewnątrz głównej karty — bez osobnego kartonu. */
  embedded?: boolean;
}) {
  if (!notes.length) return null;

  function navigate(noteId: string) {
    if (onTaskClick) {
      onTaskClick(noteId);
      return;
    }
    document.getElementById(`note-${noteId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const shellClass = embedded
    ? "border-b border-violet-100 bg-violet-50/60 px-3 py-3 sm:px-4"
    : "rounded-md border border-violet-200/80 bg-violet-50/40 p-3 sm:p-4";

  return (
    <section className={shellClass}>
      <div className="mb-2">
        <h2 className="text-sm font-semibold text-slate-900">Do zrobienia dziś</h2>
        <p className="text-xs text-slate-600">
          {notes.length}{" "}
          {notes.length === 1 ? "przypomnienie wymaga uwagi" : "przypomnień wymaga uwagi"}
        </p>
      </div>
      <ul className="flex flex-col gap-1.5">
        {notes.map((note) => (
          <li key={note.id}>
            <button
              type="button"
              onClick={() => navigate(note.id)}
              className="flex w-full items-center justify-between gap-2 rounded-md border border-white/80 bg-white/90 px-3 py-2 text-left shadow-sm transition hover:border-violet-200 hover:bg-white"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="purple" className="text-[10px]">
                    {note.visibility === "public" ? "Wspólna" : "Prywatna"}
                  </Badge>
                  <span className="truncate text-xs font-semibold text-slate-900">
                    {note.title?.trim() || note.body.trim().slice(0, 80)}
                  </span>
                </div>
                {note.follow_up_at ? (
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">
                    {formatFollowUpLabel(note.follow_up_at)}
                  </p>
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
