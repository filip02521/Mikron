"use client";

import { useState } from "react";
import { actionRestoreOperationsNote } from "@/app/actions/operations-notepad";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatShortDate } from "@/lib/sales/notepad-format";
import type { OperationsNote } from "@/types/database";
import { NOTE_COLOR_CARD } from "@/components/notatnik/note-styles";
import { NOTATNIK_NOTES_GRID_CLASS } from "@/components/notatnik/notatnik-layout";

export function OperationsArchivedNotesSection({
  notes,
  canRestore,
  onRestored,
}: {
  notes: OperationsNote[];
  canRestore: (note: OperationsNote) => boolean;
  onRestored?: (note: OperationsNote) => void;
}) {
  if (!notes.length) return null;

  return (
    <div className={NOTATNIK_NOTES_GRID_CLASS}>
      {notes.map((note) => (
        <div key={note.id}>
          <ArchivedNoteCard
            note={note}
            canRestore={canRestore(note)}
            onRestored={onRestored}
          />
        </div>
      ))}
    </div>
  );
}

function ArchivedNoteCard({
  note,
  canRestore,
  onRestored,
}: {
  note: OperationsNote;
  canRestore: boolean;
  onRestored?: (note: OperationsNote) => void;
}) {
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function restore() {
    if (!canRestore || restoring) return;
    setRestoring(true);
    setError(null);
    try {
      const { note: restored } = await actionRestoreOperationsNote(note.id);
      onRestored?.(restored);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się przywrócić notatki.");
    } finally {
      setRestoring(false);
    }
  }

  const archivedLabel = formatShortDate(note.archived_at);

  return (
    <article
      className={cn(
        "flex w-full flex-col rounded-md border p-2.5 text-xs opacity-90 sm:p-3",
        NOTE_COLOR_CARD[note.color] ?? NOTE_COLOR_CARD.default
      )}
    >
      {note.title?.trim() ? (
        <p className="mb-0.5 text-xs font-semibold text-slate-800">{note.title}</p>
      ) : null}
      <p className="whitespace-pre-wrap leading-snug text-slate-700">{note.body}</p>
      {archivedLabel ? (
        <p className="mt-1.5 text-[10px] text-slate-500">Zarchiwizowano {archivedLabel}</p>
      ) : null}
      {canRestore ? (
        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-black/5 pt-2">
          <Button size="sm" variant="ghost" disabled={restoring} onClick={() => void restore()}>
            {restoring ? "Przywracam…" : "Przywróć"}
          </Button>
          {error ? <p className="w-full text-xs text-red-600">{error}</p> : null}
        </div>
      ) : null}
    </article>
  );
}
