"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  actionArchiveOperationsNote,
  actionCreateOperationsNote,
  actionReorderOperationsNotes,
  actionUpdateOperationsNote,
} from "@/app/actions/operations-notepad";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { KeyboardShortcutsHint } from "@/components/ui/KeyboardShortcutsHint";
import { cn } from "@/lib/cn";
import { controlFocusClass, panelTypography } from "@/lib/ui/ontime-theme";
import {
  reorderOperationsNoteIds,
  sortOperationsNotes,
  notesInSamePinBand,
} from "@/lib/operations/operations-note-sort";
import type {
  OperationsDepartment,
  OperationsNote,
  OperationsNoteVisibility,
  SalesNoteColor,
} from "@/types/database";
import { isFollowUpDue } from "@/lib/sales/notepad-follow-up";
import { NoteColorPicker, NoteCardToolbar } from "@/components/notatnik/NoteColorPicker";
import { NotatnikListFilterBar } from "@/components/notatnik/NotatnikListFilterBar";
import { NoteFollowUpControl } from "@/components/notatnik/NoteFollowUpControl";
import { FollowUpQuickDates } from "@/components/notatnik/FollowUpQuickDates";
import {
  NOTATNIK_INPUT_CLASS,
  NOTATNIK_NOTES_GRID_CLASS,
  NOTATNIK_TEXTAREA_CLASS,
} from "@/components/notatnik/notatnik-layout";
import { NOTE_COLOR_CARD } from "@/components/notatnik/note-styles";
import { DragHandleGlyph, PinGlyph } from "@/components/ui/UiGlyphs";
import { IconGripVertical } from "@/components/icons/StrokeIcons";

export const NOTATNIK_KEYBOARD_HINTS = [
  { keys: ["N"], label: "nowa notatka" },
  { keys: ["/"], label: "szukaj" },
  { keys: ["↑", "↓"], label: "fokus karty" },
  { keys: ["E"], label: "edytuj" },
  { keys: ["P"], label: "przypnij" },
  { keys: ["Ctrl", "Enter"], label: "zapisz" },
  { keys: ["Ctrl", "Z"], label: "cofnij" },
] as const;

function NoteCard({
  note,
  anchorId,
  readOnly,
  showAuthor,
  focused,
  draggable,
  isDragging,
  dragOver,
  pendingKeyboardAction,
  onConsumeKeyboardAction,
  onFocus,
  onUpdated,
  onArchived,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  note: OperationsNote;
  anchorId?: string;
  readOnly?: boolean;
  showAuthor?: boolean;
  focused?: boolean;
  draggable?: boolean;
  isDragging?: boolean;
  dragOver?: boolean;
  pendingKeyboardAction?: "edit" | "pin" | null;
  onConsumeKeyboardAction?: () => void;
  onFocus?: () => void;
  onUpdated?: (note: OperationsNote) => void;
  onArchived?: (note: OperationsNote) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}) {
  const noteSyncKey = `${note.id}\0${note.updated_at}`;
  const [appliedNoteSyncKey, setAppliedNoteSyncKey] = useState(noteSyncKey);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(note.body);
  const [title, setTitle] = useState(note.title ?? "");
  const [color, setColor] = useState(note.color);
  const [pinned, setPinned] = useState(note.pinned);
  const [followUpAt, setFollowUpAt] = useState<string | null>(note.follow_up_at?.slice(0, 10) ?? null);
  const [followUpDraft, setFollowUpDraft] = useState(note.follow_up_at?.slice(0, 10) ?? "");
  const [saving, setSaving] = useState(false);
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (noteSyncKey !== appliedNoteSyncKey) {
    setAppliedNoteSyncKey(noteSyncKey);
    setBody(note.body);
    setTitle(note.title ?? "");
    setColor(note.color);
    setPinned(note.pinned);
    const iso = note.follow_up_at?.slice(0, 10) ?? null;
    setFollowUpAt(iso);
    setFollowUpDraft(iso ?? "");
  }

  const pendingKey = pendingKeyboardAction ? `${note.id}:${pendingKeyboardAction}` : null;
  const [handledPendingKey, setHandledPendingKey] = useState<string | null>(null);
  if (pendingKey && pendingKey !== handledPendingKey && !readOnly) {
    setHandledPendingKey(pendingKey);
    onConsumeKeyboardAction?.();
    if (pendingKeyboardAction === "edit") {
      setEditing(true);
    } else if (pendingKeyboardAction === "pin") {
      const nextPinned = !pinned;
      setPinned(nextPinned);
      void actionUpdateOperationsNote(note.id, { pinned: nextPinned })
        .then(() => onUpdated?.({ ...note, pinned: nextPinned }))
        .catch(() => setPinned(!nextPinned));
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const trimmedFollowUp = followUpDraft.trim() || null;
      await actionUpdateOperationsNote(note.id, {
        body,
        title: title || null,
        color,
        follow_up_at: trimmedFollowUp,
      });
      setFollowUpAt(trimmedFollowUp);
      onUpdated?.({
        ...note,
        body: body.trim(),
        title: title.trim() || null,
        color,
        follow_up_at: trimmedFollowUp,
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
      await actionUpdateOperationsNote(note.id, { color: nextColor });
      onUpdated?.({ ...note, color: nextColor });
    } catch {
      setColor(prev);
    }
  }

  async function changeFollowUp(next: string | null) {
    if (readOnly) return;
    const prev = followUpAt;
    setFollowUpAt(next);
    setSavingFollowUp(true);
    setError(null);
    try {
      await actionUpdateOperationsNote(note.id, { follow_up_at: next });
      onUpdated?.({ ...note, follow_up_at: next });
    } catch (e) {
      setFollowUpAt(prev);
      setError(e instanceof Error ? e.message : "Nie udało się ustawić przypomnienia.");
      throw e;
    } finally {
      setSavingFollowUp(false);
    }
  }

  async function togglePin() {
    const nextPinned = !pinned;
    setPinned(nextPinned);
    try {
      await actionUpdateOperationsNote(note.id, { pinned: nextPinned });
      onUpdated?.({ ...note, pinned: nextPinned });
    } catch {
      setPinned(!nextPinned);
    }
  }

  async function archive() {
    setError(null);
    try {
      await actionArchiveOperationsNote(note.id);
      onArchived?.(note);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zarchiwizować notatki.");
    }
  }

  const followUpDue = isFollowUpDue(followUpAt);
  const displayTitle = editing ? title : note.title;
  const displayBody = editing ? body : note.body;
  const displayColor = editing ? color : note.color;

  return (
    <article
      id={anchorId}
      tabIndex={focused ? 0 : -1}
      draggable={draggable && !editing}
      onDragStart={(e) => {
        if (!draggable || editing) return;
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onFocus={onFocus}
      onDoubleClick={() => {
        if (!readOnly && !editing) setEditing(true);
      }}
      className={cn(
        anchorId && "scroll-mt-3 scroll-mb-3",
        "group relative flex w-full flex-col overflow-visible rounded-md border p-2.5 shadow-sm transition-shadow hover:shadow-md",
        NOTE_COLOR_CARD[displayColor] ?? NOTE_COLOR_CARD.default,
        pinned && !editing ? "ring-1 ring-inset ring-indigo-200/80" : undefined,
        followUpDue && !editing ? "ring-1 ring-inset ring-violet-200/80" : undefined,
        focused ? "z-10 ring-2 ring-inset ring-indigo-400/70" : undefined,
        dragOver ? "border-indigo-300 bg-white/90" : undefined,
        isDragging ? "opacity-50" : undefined
      )}
    >
      {draggable && !editing && !readOnly ? (
        <span
          className="absolute left-1.5 top-1.5 cursor-grab text-slate-400 opacity-0 transition group-hover:opacity-100 active:cursor-grabbing"
          aria-hidden
          title="Przeciągnij, aby zmienić kolejność"
        >
          <IconGripVertical size={14} strokeWidth={2.5} />
        </span>
      ) : null}

      {pinned && !editing ? (
        <span className="absolute right-2 top-2" title="Przypięta" aria-label="Przypięta">
          <PinGlyph size={13} />
        </span>
      ) : null}

      {editing && !readOnly ? (
        <div className="space-y-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tytuł (opcjonalnie)"
            className={cn(NOTATNIK_INPUT_CLASS, "w-full text-xs")}
          />
          <textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className={cn(NOTATNIK_TEXTAREA_CLASS, "w-full text-xs")}
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-600">Przypomnij</span>
            <input
              type="date"
              value={followUpDraft}
              onChange={(e) => setFollowUpDraft(e.target.value)}
              className={cn(NOTATNIK_INPUT_CLASS, "h-8 w-auto text-xs")}
            />
          </div>
          <NoteColorPicker value={color} onChange={setColor} disabled={saving} size="sm" />
          <div className="flex flex-wrap gap-1.5">
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
          {displayTitle?.trim() ? (
            <h3 className="mb-0.5 pr-5 pl-3 text-xs font-semibold leading-snug text-slate-900">
              {displayTitle}
            </h3>
          ) : null}
          {showAuthor && note.author?.email ? (
            <p className="mb-0.5 pl-3 text-[10px] text-slate-500">{note.author.email}</p>
          ) : null}
          <p className="whitespace-pre-wrap pl-3 text-xs leading-snug text-slate-800">{displayBody}</p>

          {!readOnly ? (
            <div className="mt-2 space-y-1.5 overflow-visible border-t border-black/5 pt-2">
              <NoteFollowUpControl
                value={followUpAt}
                onChange={changeFollowUp}
                saving={savingFollowUp}
              />
              <div className="space-y-1.5 overflow-visible py-0.5 transition-opacity lg:opacity-100 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
                <NoteColorPicker
                  value={displayColor}
                  onChange={(c) => void changeColor(c)}
                  size="sm"
                />
                <NoteCardToolbar
                  pinned={pinned}
                  saving={saving || savingFollowUp}
                  onEdit={() => setEditing(true)}
                  onTogglePin={() => void togglePin()}
                  onArchive={() => void archive()}
                />
              </div>
            </div>
          ) : followUpAt ? (
            <div className="mt-2 border-t border-black/5 pt-2">
              <NoteFollowUpControl value={followUpAt} onChange={() => {}} disabled />
            </div>
          ) : null}
        </>
      )}
      {error ? <p className="mt-1 text-[10px] text-red-600">{error}</p> : null}
    </article>
  );
}

export function OperationsNotesSection({
  notes,
  department,
  visibility,
  currentUserId,
  readOnly,
  embedded,
  onNoteCreated,
  onNoteUpdated,
  onNoteArchived,
  onNotesReordered,
  allowReorder = true,
}: {
  notes: OperationsNote[];
  department: OperationsDepartment;
  visibility: OperationsNoteVisibility;
  currentUserId: string;
  readOnly?: boolean;
  embedded?: boolean;
  allowReorder?: boolean;
  onNoteCreated?: (note: OperationsNote) => void;
  onNoteUpdated?: (note: OperationsNote) => void;
  onNoteArchived?: (note: OperationsNote) => void;
  onNotesReordered?: (notes: OperationsNote[], previousForUndo?: OperationsNote[]) => void;
}) {
  const showAuthor = visibility === "public";
  const canCompose = !readOnly;
  const [draftTitle, setDraftTitle] = useState("");
  const [draft, setDraft] = useState("");
  const [draftColor, setDraftColor] = useState<SalesNoteColor>("default");
  const [draftFollowUp, setDraftFollowUp] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [focusedNoteId, setFocusedNoteId] = useState<string | null>(null);
  const [keyboardAction, setKeyboardAction] = useState<{
    noteId: string;
    action: "edit" | "pin";
  } | null>(null);
  const composeRef = useRef<HTMLDivElement>(null);

  const composeExpanded =
    composeOpen || Boolean(draft.trim() || draftTitle.trim() || draftFollowUp);

  useEffect(() => {
    if (composeOpen) composeRef.current?.querySelector<HTMLElement>("textarea")?.focus();
  }, [composeOpen]);

  const sorted = sortOperationsNotes(notes);
  const needle = searchQuery.trim().toLowerCase();
  const filtered = needle
    ? sorted.filter(
        (note) =>
          note.body.toLowerCase().includes(needle) ||
          note.title?.toLowerCase().includes(needle)
      )
    : sorted;

  const canDrag = allowReorder && !readOnly && !needle;

  const pinnedFiltered = filtered.filter((n) => n.pinned);
  const regularFiltered = filtered.filter((n) => !n.pinned);

  const persistReorder = useCallback(
    async (nextIds: string[] | null) => {
      if (!nextIds) {
        setError("Kolejność można zmieniać tylko w sekcji przypiętych lub zwykłych notatek.");
        return;
      }
      const prev = sortOperationsNotes(notes);
      const optimistic = nextIds.map((id, index) => {
        const note = prev.find((n) => n.id === id)!;
        return { ...note, sort_order: index };
      });
      onNotesReordered?.(optimistic);
      try {
        await actionReorderOperationsNotes(department, visibility, nextIds);
        onNotesReordered?.(optimistic, prev);
      } catch (e) {
        onNotesReordered?.(prev);
        setError(e instanceof Error ? e.message : "Nie udało się zmienić kolejności.");
      }
    },
    [notes, onNotesReordered, department, visibility]
  );

  function renderNoteGrid(list: OperationsNote[], sectionLabel?: string) {
    if (!list.length) return null;
    const draggingNote = draggingId ? notes.find((n) => n.id === draggingId) : null;

    return (
      <div className="space-y-1.5">
        {sectionLabel ? (
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            {sectionLabel}
          </p>
        ) : null}
        <div className={NOTATNIK_NOTES_GRID_CLASS}>
          {list.map((note) => (
            <div key={note.id}>
              <NoteCard
                note={note}
                anchorId={`note-${note.id}`}
                readOnly={readOnly || note.created_by !== currentUserId}
                showAuthor={showAuthor}
                focused={focusedNoteId === note.id}
                draggable={canDrag}
                isDragging={draggingId === note.id}
                dragOver={
                  dragOverId === note.id &&
                  draggingId !== note.id &&
                  !!draggingNote &&
                  notesInSamePinBand(draggingNote, note)
                }
                pendingKeyboardAction={
                  keyboardAction?.noteId === note.id ? keyboardAction.action : null
                }
                onConsumeKeyboardAction={() => setKeyboardAction(null)}
                onFocus={() => setFocusedNoteId(note.id)}
                onUpdated={onNoteUpdated}
                onArchived={onNoteArchived}
                onDragStart={() => setDraggingId(note.id)}
                onDragEnd={() => {
                  setDraggingId(null);
                  setDragOverId(null);
                }}
                onDragOver={(e) => {
                  if (!canDrag || !draggingId || draggingId === note.id) return;
                  const from = notes.find((n) => n.id === draggingId);
                  if (!from || !notesInSamePinBand(from, note)) return;
                  e.preventDefault();
                  setDragOverId(note.id);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!draggingId || draggingId === note.id) return;
                  const nextIds = reorderOperationsNoteIds(notes, draggingId, note.id);
                  setDraggingId(null);
                  setDragOverId(null);
                  void persistReorder(nextIds);
                }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (!focusedNoteId) return;
    document.getElementById(`note-${focusedNoteId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [focusedNoteId]);

  useEffect(() => {
    if (readOnly) return;

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inField = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if (inField) {
        if (e.key === "Escape") (e.target as HTMLElement).blur();
        return;
      }

      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setComposeOpen(true);
        return;
      }

      if (!filtered.length) return;

      const idx = focusedNoteId ? filtered.findIndex((n) => n.id === focusedNoteId) : -1;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextIdx = idx < 0 ? 0 : Math.min(idx + 1, filtered.length - 1);
        setFocusedNoteId(filtered[nextIdx]!.id);
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        const nextIdx = idx < 0 ? 0 : Math.max(idx - 1, 0);
        setFocusedNoteId(filtered[nextIdx]!.id);
        return;
      }

      if (!focusedNoteId) return;

      if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        setKeyboardAction({ noteId: focusedNoteId, action: "edit" });
        return;
      }

      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        setKeyboardAction({ noteId: focusedNoteId, action: "pin" });
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readOnly, filtered, focusedNoteId]);

  async function createNote() {
    const trimmed = draft.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      const { note } = await actionCreateOperationsNote(department, visibility, trimmed, {
        title: draftTitle.trim() || null,
        color: draftColor,
        follow_up_at: draftFollowUp.trim() || null,
      });
      setDraft("");
      setDraftTitle("");
      setDraftColor("default");
      setDraftFollowUp("");
      setComposeOpen(false);
      onNoteCreated?.(note);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się dodać notatki.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {!embedded ? (
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className={panelTypography.sectionTitle}>Notatki</h2>
            <KeyboardShortcutsHint items={[...NOTATNIK_KEYBOARD_HINTS]} className="mt-1" compact />
          </div>
        </div>
      ) : null}

      {canCompose ? (
        composeExpanded ? (
          <div
            ref={composeRef}
            className={cn(
              "rounded-md border p-3",
              NOTE_COLOR_CARD[draftColor] ?? NOTE_COLOR_CARD.default
            )}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void createNote();
              }
            }}
          >
            <div className="space-y-2">
              <input
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="Tytuł (opcjonalnie)"
                className={cn(
                  "h-8 w-full rounded-md border border-white/80 bg-white/80 px-2 text-xs",
                  controlFocusClass
                )}
              />
              <textarea
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Wpisz notatkę…"
                className={cn(
                  "w-full rounded-md border border-white/80 bg-white px-2 py-1.5 text-xs leading-snug",
                  controlFocusClass
                )}
              />
              <div className="space-y-1.5">
                <span className="text-[10px] font-medium text-slate-600">Przypomnij</span>
                <FollowUpQuickDates
                  value={draftFollowUp || null}
                  disabled={saving}
                  onPick={setDraftFollowUp}
                />
                <input
                  id="note-compose-follow-up"
                  type="date"
                  value={draftFollowUp}
                  onChange={(e) => setDraftFollowUp(e.target.value)}
                  className={cn(NOTATNIK_INPUT_CLASS, "h-8 w-auto text-xs")}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <NoteColorPicker value={draftColor} onChange={setDraftColor} disabled={saving} size="sm" />
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDraft("");
                      setDraftTitle("");
                      setDraftFollowUp("");
                      setDraftColor("default");
                      setComposeOpen(false);
                    }}
                  >
                    Anuluj
                  </Button>
                  <Button size="sm" disabled={saving || !draft.trim()} onClick={() => void createNote()}>
                    {saving ? "Zapis…" : "Dodaj"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="flex w-full items-center gap-2 rounded-md border border-dashed border-slate-200 bg-slate-50/60 px-3 py-2.5 text-left text-xs text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50/40 hover:text-indigo-800 min-h-11 sm:min-h-0"
          >
            <span className="text-base leading-none text-indigo-600" aria-hidden>
              +
            </span>
            Wpisz notatkę…
            <span className="ml-auto hidden sm:inline">
              <KeyboardShortcutsHint items={[{ keys: ["N"], label: "" }]} compact />
            </span>
          </button>
        )
      ) : null}

      {notes.length > 0 ? (
        <div className={cn(!readOnly && "mt-3")}>
          <NotatnikListFilterBar
            embedded
            value={searchQuery}
            onChange={setSearchQuery}
            matchCount={filtered.length}
            totalCount={notes.length}
            placeholder="Szukaj po tytule lub treści notatki…"
            searchLabel="Szukaj w notatkach"
            idleHint="Filtruj notatki po tytule lub treści."
            activeHint="Wyniki z przypiętych i zwykłych notatek na liście."
            emptyMatchHint="Brak dopasowań — sprawdź tytuł lub treść notatki."
          />
        </div>
      ) : null}

      {canDrag && filtered.length > 1 ? (
        <p className="inline-flex flex-wrap items-center gap-1 text-[10px] text-slate-400">
          Przeciągnij kartę (
          <DragHandleGlyph />
          ) w sekcji przypiętych lub zwykłych — między sekcjami nie da się przenieść.
        </p>
      ) : null}

      {error ? <Alert tone="error">{error}</Alert> : null}

      {filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-200 bg-slate-50/80 px-3 py-4 text-center text-xs text-slate-500">
          {needle ? "Brak notatek pasujących do wyszukiwania." : "Brak notatek."}
        </p>
      ) : (
        <div className="space-y-4">
          {renderNoteGrid(pinnedFiltered, pinnedFiltered.length ? "Przypięte" : undefined)}
          {renderNoteGrid(regularFiltered, pinnedFiltered.length ? "Pozostałe" : undefined)}
        </div>
      )}
    </div>
  );
}
