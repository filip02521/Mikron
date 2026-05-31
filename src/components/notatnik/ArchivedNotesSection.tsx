"use client";

import { useState } from "react";
import { actionRestoreSalesNote, actionDeleteArchivedSalesNote } from "@/app/actions/sales-notepad";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatShortDate } from "@/lib/sales/notepad-format";
import type { SalesNote } from "@/types/database";
import { NOTE_COLOR_CARD } from "./note-styles";
import { NOTATNIK_NOTES_GRID_CLASS } from "./notatnik-layout";

export function ArchivedNotesSection({
  notes,
  readOnly,
  onRestored,
  onDeleted,
}: {
  notes: SalesNote[];
  readOnly?: boolean;
  onRestored?: (note: SalesNote) => void;
  onDeleted?: (noteId: string) => void;
}) {
  if (!notes.length) return null;

  return (
    <div className={NOTATNIK_NOTES_GRID_CLASS}>
      {notes.map((note) => (
        <div key={note.id}>
          <ArchivedNoteCard
            note={note}
            readOnly={readOnly}
            onRestored={onRestored}
            onDeleted={onDeleted}
          />
        </div>
      ))}
    </div>
  );
}

function ArchivedNoteCard({
  note,
  readOnly,
  onRestored,
  onDeleted,
}: {
  note: SalesNote;
  readOnly?: boolean;
  onRestored?: (note: SalesNote) => void;
  onDeleted?: (noteId: string) => void;
}) {
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function restore() {
    if (readOnly || restoring) return;
    setRestoring(true);
    setError(null);
    try {
      const { note: restored } = await actionRestoreSalesNote(note.id);
      onRestored?.(restored);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się przywrócić notatki.");
    } finally {
      setRestoring(false);
    }
  }

  async function remove() {
    if (readOnly || deleting) return;
    if (!window.confirm("Usunąć notatkę z archiwum na stałe? Tej operacji nie można cofnąć.")) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await actionDeleteArchivedSalesNote(note.id);
      onDeleted?.(note.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się usunąć notatki.");
    } finally {
      setDeleting(false);
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
      {!readOnly ? (
        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-black/5 pt-2">
          <Button size="sm" variant="ghost" disabled={restoring} onClick={() => void restore()}>
            {restoring ? "Przywracam…" : "Przywróć"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={deleting}
            onClick={() => void remove()}
            className="text-red-700 hover:text-red-900"
          >
            {deleting ? "Usuwam…" : "Usuń na stałe"}
          </Button>
          {error ? <p className="w-full text-xs text-red-600">{error}</p> : null}
        </div>
      ) : null}
    </article>
  );
}
