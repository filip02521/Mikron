"use client";

import { useEffect, useState } from "react";
import { actionRestoreSalesNote, actionDeleteArchivedSalesNote } from "@/app/actions/sales-notepad";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatShortDate } from "@/lib/sales/notepad-format";
import { flashNotepadAnchor, NOTEPAD_ANCHOR_FLASH_CLASSES } from "@/lib/sales/notepad-anchor";
import { salesTypography } from "@/lib/ui/ontime-theme";
import type { SalesNote } from "@/types/database";
import { noteStickyPaperClass } from "./note-styles";
import { NOTATNIK_NOTES_GRID_CLASS, NOTATNIK_NOTES_WALL_CLASS } from "./notatnik-layout";
import { NoteBodyDisplay } from "./NoteBodyDisplay";
import { NoteStickyFrame } from "./NoteStickyFrame";

export function ArchivedNotesSection({
  notes,
  readOnly,
  embedded,
  className,
  focusNoteId,
  onFocusNoteHandled,
  onRestored,
  onDeleted,
}: {
  notes: SalesNote[];
  readOnly?: boolean;
  /** W panelu archiwum — bez podwójnej etykiety i zewnętrznego paddingu. */
  embedded?: boolean;
  className?: string;
  focusNoteId?: string | null;
  onFocusNoteHandled?: (noteId: string) => void;
  onRestored?: (note: SalesNote) => void;
  onDeleted?: (noteId: string) => void;
}) {
  if (!notes.length) return null;

  const grid = (
    <div className={NOTATNIK_NOTES_GRID_CLASS}>
      {notes.map((note) => (
        <ArchivedNoteCard
          key={note.id}
          note={note}
          readOnly={readOnly}
          focus={focusNoteId === note.id}
          onFocusHandled={onFocusNoteHandled}
          onRestored={onRestored}
          onDeleted={onDeleted}
        />
      ))}
    </div>
  );

  return (
    <div className={cn(NOTATNIK_NOTES_WALL_CLASS, "space-y-3", className)}>
      {!embedded ? (
        <p className={cn(salesTypography.sectionLabel, "px-0.5")}>Zarchiwizowane</p>
      ) : null}
      {grid}
    </div>
  );
}

function ArchivedNoteCard({
  note,
  readOnly,
  focus,
  onFocusHandled,
  onRestored,
  onDeleted,
}: {
  note: SalesNote;
  readOnly?: boolean;
  focus?: boolean;
  onFocusHandled?: (noteId: string) => void;
  onRestored?: (note: SalesNote) => void;
  onDeleted?: (noteId: string) => void;
}) {
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const anchorId = `note-${note.id}`;

  useEffect(() => {
    if (!focus) return;
    flashNotepadAnchor(anchorId, { onFound: () => onFocusHandled?.(note.id) });
  }, [anchorId, focus, note.id, onFocusHandled]);

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
    <NoteStickyFrame seed={note.id} straight={focus}>
      <article
        id={anchorId}
        className={cn(
          noteStickyPaperClass(note.color, { archived: true, focused: focus }),
          ...(focus ? NOTEPAD_ANCHOR_FLASH_CLASSES : [])
        )}
      >
        <div className="px-2.5 py-3 pt-3.5">
          {note.title?.trim() ? (
            <h3 className="text-[13px] font-bold text-slate-900">{note.title}</h3>
          ) : null}
          <div className={note.title?.trim() ? "mt-1" : undefined}>
            <NoteBodyDisplay body={note.body} />
          </div>
          {archivedLabel ? (
            <p className={cn(salesTypography.chrome, "mt-2 text-slate-500")}>
              Zarchiwizowano {archivedLabel}
            </p>
          ) : null}
        </div>
        {!readOnly ? (
          <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-2.5 py-2">
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
            {error ? <p className="w-full text-xs text-red-700">{error}</p> : null}
          </div>
        ) : null}
      </article>
    </NoteStickyFrame>
  );
}
