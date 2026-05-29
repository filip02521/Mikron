"use client";

import { useEffect, useState } from "react";
import {
  actionArchiveSalesNote,
  actionCreateSalesNote,
  actionUpdateSalesNote,
} from "@/app/actions/sales-notepad";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { cn } from "@/lib/cn";
import { controlFocusClass } from "@/lib/ui/ontime-theme";
import type { SalesNote, SalesNoteColor } from "@/types/database";
import { formatFollowUpLabel, isFollowUpDue } from "@/lib/sales/notepad-follow-up";
import { Badge } from "@/components/ui/Badge";
import { NoteColorPicker } from "./NoteColorPicker";
import { NOTE_COLOR_CARD } from "./note-styles";

function NoteCard({
  note,
  readOnly,
  onUpdated,
  onArchived,
}: {
  note: SalesNote;
  readOnly?: boolean;
  onUpdated?: (note: SalesNote) => void;
  onArchived?: (noteId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(note.body);
  const [title, setTitle] = useState(note.title ?? "");
  const [color, setColor] = useState(note.color);
  const [pinned, setPinned] = useState(note.pinned);
  const [followUpDraft, setFollowUpDraft] = useState(note.follow_up_at?.slice(0, 10) ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBody(note.body);
    setTitle(note.title ?? "");
    setColor(note.color);
    setPinned(note.pinned);
    setFollowUpDraft(note.follow_up_at?.slice(0, 10) ?? "");
  }, [note]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await actionUpdateSalesNote(note.id, {
        body,
        title: title || null,
        color,
      });
      onUpdated?.({
        ...note,
        body: body.trim(),
        title: title.trim() || null,
        color,
      });
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać notatki.");
    } finally {
      setSaving(false);
    }
  }

  async function changeColor(nextColor: SalesNoteColor) {
    if (readOnly || nextColor === color) return;
    const prev = color;
    setColor(nextColor);
    try {
      await actionUpdateSalesNote(note.id, { color: nextColor });
      onUpdated?.({ ...note, color: nextColor });
    } catch {
      setColor(prev);
    }
  }

  async function togglePin() {
    const nextPinned = !pinned;
    setPinned(nextPinned);
    try {
      await actionUpdateSalesNote(note.id, { pinned: nextPinned });
      onUpdated?.({ ...note, pinned: nextPinned });
    } catch {
      setPinned(!nextPinned);
    }
  }

  async function saveFollowUp(nextValue?: string) {
    if (readOnly) return;
    const value = (nextValue ?? followUpDraft).trim();
    const normalized = value || null;
    if (normalized === (note.follow_up_at?.slice(0, 10) ?? null)) return;
    try {
      await actionUpdateSalesNote(note.id, { follow_up_at: normalized });
      onUpdated?.({ ...note, follow_up_at: normalized });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać przypomnienia.");
    }
  }

  const followUpDue = isFollowUpDue(note.follow_up_at);
  const followUpLabel = formatFollowUpLabel(note.follow_up_at);

  async function archive() {
    setError(null);
    try {
      await actionArchiveSalesNote(note.id);
      onArchived?.(note.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zarchiwizować notatki.");
    }
  }

  const displayTitle = editing ? title : note.title;
  const displayBody = editing ? body : note.body;
  const displayColor = editing ? color : note.color;

  return (
    <article
      className={cn(
        "flex flex-col rounded-xl border p-4 shadow-sm",
        NOTE_COLOR_CARD[displayColor] ?? NOTE_COLOR_CARD.default,
        pinned && !editing ? "ring-1 ring-indigo-200/80" : undefined,
        followUpDue && !editing ? "ring-1 ring-violet-200/80" : undefined
      )}
    >
      {editing && !readOnly ? (
        <div className="space-y-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tytuł (opcjonalnie)"
            className={cn(
              "w-full rounded-md border border-slate-200/80 bg-white/70 px-2 py-1 text-sm",
              controlFocusClass
            )}
          />
          <textarea
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className={cn(
              "w-full rounded-md border border-slate-200/80 bg-white/70 px-2 py-1.5 text-sm",
              controlFocusClass
            )}
          />
          <NoteColorPicker value={color} onChange={setColor} disabled={saving} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={saving} onClick={() => void save()}>
              {saving ? "Zapis…" : "Zapisz"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Anuluj
            </Button>
          </div>
        </div>
      ) : (
        <>
          {pinned ? (
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-600">
              Przypięta
            </p>
          ) : null}
          {followUpDue ? (
            <Badge variant="purple" className="mb-1 text-[10px]">
              Follow-up
            </Badge>
          ) : null}
          {displayTitle?.trim() ? (
            <h3 className="mb-1 text-sm font-semibold text-slate-900">{displayTitle}</h3>
          ) : null}
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
            {displayBody}
          </p>
          {followUpLabel ? (
            <p className={cn("mt-2 text-xs", followUpDue ? "font-semibold text-violet-800" : "text-slate-500")}>
              Przypomnienie {followUpLabel}
            </p>
          ) : null}
          {!readOnly ? (
            <div className="mt-3 space-y-3 border-t border-black/5 pt-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <label htmlFor={`note-follow-up-${note.id}`} className="font-medium">
                  Przypomnij
                </label>
                <input
                  id={`note-follow-up-${note.id}`}
                  type="date"
                  value={followUpDraft}
                  onChange={(e) => setFollowUpDraft(e.target.value)}
                  onBlur={() => void saveFollowUp()}
                  className={cn(
                    "rounded-md border border-slate-200/80 bg-white/70 px-2 py-1 text-sm",
                    controlFocusClass
                  )}
                />
                {followUpDraft ? (
                  <button
                    type="button"
                    className="text-slate-500 hover:text-slate-800"
                    onClick={() => {
                      setFollowUpDraft("");
                      void saveFollowUp("");
                    }}
                  >
                    Wyczyść
                  </button>
                ) : null}
              </div>
              <NoteColorPicker value={displayColor} onChange={(c) => void changeColor(c)} />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                  Edytuj
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void togglePin()}>
                  {pinned ? "Odepnij" : "Przypnij"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void archive()}>
                  Archiwum
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </article>
  );
}

export function NotesSection({
  notes,
  readOnly,
  onNoteCreated,
  onNoteUpdated,
  onNoteArchived,
}: {
  notes: SalesNote[];
  readOnly?: boolean;
  onNoteCreated?: (note: SalesNote) => void;
  onNoteUpdated?: (note: SalesNote) => void;
  onNoteArchived?: (noteId: string) => void;
}) {
  const [draftTitle, setDraftTitle] = useState("");
  const [draft, setDraft] = useState("");
  const [draftColor, setDraftColor] = useState<SalesNoteColor>("default");
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createNote() {
    const trimmed = draft.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      const { note } = await actionCreateSalesNote(trimmed, {
        title: draftTitle.trim() || null,
        color: draftColor,
      });
      setDraft("");
      setDraftTitle("");
      setDraftColor("default");
      onNoteCreated?.(note);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się dodać notatki.");
    } finally {
      setSaving(false);
    }
  }

  const sorted = [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const followA = isFollowUpDue(a.follow_up_at);
    const followB = isFollowUpDue(b.follow_up_at);
    if (followA !== followB) return followA ? -1 : 1;
    return b.updated_at.localeCompare(a.updated_at);
  });

  const needle = searchQuery.trim().toLowerCase();
  const filtered = needle
    ? sorted.filter(
        (note) =>
          note.body.toLowerCase().includes(needle) ||
          note.title?.toLowerCase().includes(needle)
      )
    : sorted;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Notatki</h2>
        <p className="mt-1 text-sm text-slate-500">Krótkie zapiski — jak w Keep.</p>
      </div>

      {!readOnly ? (
        <div
          className={cn(
            "rounded-xl border p-4 shadow-sm",
            NOTE_COLOR_CARD[draftColor] ?? NOTE_COLOR_CARD.default
          )}
        >
          <input
            type="text"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder="Tytuł (opcjonalnie)"
            className={cn(
              "mb-2 w-full rounded-lg border border-white/80 bg-white/80 px-3 py-2 text-sm",
              controlFocusClass
            )}
          />
          <textarea
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Wpisz notatkę…"
            className={cn(
              "w-full rounded-lg border border-white/80 bg-white px-3 py-2 text-sm",
              controlFocusClass
            )}
          />
          <div className="mt-3 space-y-2">
            <NoteColorPicker value={draftColor} onChange={setDraftColor} disabled={saving} />
            <Button size="sm" disabled={saving || !draft.trim()} onClick={() => void createNote()}>
              {saving ? "Zapis…" : "Dodaj notatkę"}
            </Button>
          </div>
        </div>
      ) : null}

      {notes.length > 0 ? (
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Szukaj w notatkach…"
          className={cn(
            "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-sm",
            controlFocusClass
          )}
        />
      ) : null}

      {error ? <Alert tone="error">{error}</Alert> : null}

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-500">
          {needle ? "Brak notatek pasujących do wyszukiwania." : "Brak notatek."}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((note) => (
            <div key={note.id} id={`note-${note.id}`}>
              <NoteCard
              note={note}
              readOnly={readOnly}
              onUpdated={onNoteUpdated}
              onArchived={onNoteArchived}
            />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
