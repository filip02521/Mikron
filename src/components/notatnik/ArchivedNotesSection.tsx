"use client";

import { useState } from "react";
import { actionRestoreSalesNote, actionDeleteArchivedSalesNote } from "@/app/actions/sales-notepad";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatShortDate } from "@/lib/sales/notepad-format";
import type { SalesNote } from "@/types/database";
import { NOTE_COLOR_CARD } from "./note-styles";

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
    <div className="grid gap-3 sm:grid-cols-2">
      {notes.map((note) => (
        <ArchivedNoteCard
          key={note.id}
          note={note}
          readOnly={readOnly}
          onRestored={onRestored}
          onDeleted={onDeleted}
        />
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
        "flex flex-col rounded-xl border p-4 text-sm opacity-90",
        NOTE_COLOR_CARD[note.color] ?? NOTE_COLOR_CARD.default
      )}
    >
      {note.title?.trim() ? (
        <p className="mb-1 font-medium text-slate-800">{note.title}</p>
      ) : null}
      <p className="whitespace-pre-wrap leading-relaxed text-slate-700">{note.body}</p>
      {archivedLabel ? (
        <p className="mt-2 text-xs text-slate-500">Zarchiwizowano {archivedLabel}</p>
      ) : null}
      {!readOnly ? (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-black/5 pt-3">
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
