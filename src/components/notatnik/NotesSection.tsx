"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  actionArchiveSalesNote,
  actionCreateSalesNote,
  actionReorderSalesNotes,
  actionUpdateSalesNote,
} from "@/app/actions/sales-notepad";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { KeyboardShortcutsHint } from "@/components/ui/KeyboardShortcutsHint";
import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";
import { reorderNoteIds, sortSalesNotes, notesInSamePinBand, filterSalesNotesByQuery } from "@/lib/sales/notepad-note-sort";
import type { SalesNote, SalesNoteColor } from "@/types/database";
import { isFollowUpDue } from "@/lib/sales/notepad-follow-up";
import { NoteColorPicker, NoteCardToolbar } from "./NoteColorPicker";
import { NoteFollowUpControl } from "./NoteFollowUpControl";
import { FollowUpQuickDates } from "./FollowUpQuickDates";
import {
  NOTATNIK_INPUT_CLASS,
  NOTATNIK_NOTES_GRID_CLASS,
  NOTATNIK_NOTES_WALL_CLASS,
  NOTATNIK_TEXTAREA_CLASS,
} from "./notatnik-layout";
import { noteStickyBoardDividerClass, noteStickyPaperClass } from "./note-styles";
import { NoteBodyDisplay } from "./NoteBodyDisplay";
import { NoteFormatToolbar } from "./NoteFormatToolbar";
import { NoteStickyFrame } from "./NoteStickyFrame";
import { handleNoteFormatKeyDown } from "@/lib/sales/note-body-format";
import { DragHandleGlyph, PinGlyph } from "@/components/ui/UiGlyphs";
import { IconGripVertical } from "@/components/icons/StrokeIcons";
import { SalesListFilterEmptyHint, SalesSectionEmptyHint } from "@/components/sales/SalesListEmptyHints";
import { NotatnikListFilterBar } from "./NotatnikListFilterBar";

export const NOTATNIK_KEYBOARD_HINTS = [
  { keys: ["N"], label: "nowa notatka" },
  { keys: ["/"], label: "szukaj" },
  { keys: ["↑", "↓"], label: "fokus karty" },
  { keys: ["E"], label: "edytuj" },
  { keys: ["P"], label: "przypnij" },
  { keys: ["Ctrl", "B"], label: "pogrubienie" },
  { keys: ["Ctrl", "Enter"], label: "zapisz" },
  { keys: ["Ctrl", "Z"], label: "cofnij" },
] as const;

function NoteCard({
  note,
  anchorId,
  readOnly,
  focused,
  draggable,
  isDragging,
  dragOver,
  startInEditMode,
  onEditingChange,
  onFocus,
  onUpdated,
  onArchived,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  note: SalesNote;
  anchorId?: string;
  readOnly?: boolean;
  focused?: boolean;
  draggable?: boolean;
  isDragging?: boolean;
  dragOver?: boolean;
  startInEditMode?: boolean;
  onEditingChange?: (editing: boolean) => void;
  onFocus?: () => void;
  onUpdated?: (note: SalesNote) => void;
  onArchived?: (note: SalesNote) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}) {
  const [editing, setEditing] = useState(Boolean(startInEditMode));
  const [body, setBody] = useState(note.body);
  const [title, setTitle] = useState(note.title ?? "");
  const [color, setColor] = useState(note.color);
  const [pinned, setPinned] = useState(note.pinned);
  const [followUpAt, setFollowUpAt] = useState<string | null>(note.follow_up_at?.slice(0, 10) ?? null);
  const [followUpDraft, setFollowUpDraft] = useState(note.follow_up_at?.slice(0, 10) ?? "");
  const [saving, setSaving] = useState(false);
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);

  function setEditingState(next: boolean) {
    setEditing(next);
    onEditingChange?.(next);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const trimmedFollowUp = followUpDraft.trim() || null;
      await actionUpdateSalesNote(note.id, {
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
      setEditingState(false);
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

  async function changeFollowUp(next: string | null) {
    if (readOnly) return;
    const prev = followUpAt;
    setFollowUpAt(next);
    setSavingFollowUp(true);
    setError(null);
    try {
      await actionUpdateSalesNote(note.id, { follow_up_at: next });
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
      await actionUpdateSalesNote(note.id, { pinned: nextPinned });
      onUpdated?.({ ...note, pinned: nextPinned });
    } catch {
      setPinned(!nextPinned);
    }
  }

  async function archive() {
    setError(null);
    try {
      await actionArchiveSalesNote(note.id);
      onArchived?.(note);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zarchiwizować notatki.");
    }
  }

  const followUpDue = isFollowUpDue(followUpAt);
  const displayTitle = editing ? title : note.title;
  const displayBody = editing ? body : note.body;
  const displayColor = editing ? color : note.color;
  const straightFrame = editing || focused || isDragging;

  return (
    <NoteStickyFrame seed={note.id} straight={straightFrame} showPin={pinned && !editing}>
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
          if (!readOnly && !editing) setEditingState(true);
        }}
        className={cn(
          anchorId && "scroll-mt-6 scroll-mb-6",
          noteStickyPaperClass(displayColor, {
            pinned,
            followUpDue,
            focused,
            dragOver,
            isDragging,
            editing,
          })
        )}
      >
      {editing && !readOnly ? (
        <div className="space-y-2 p-2.5 pt-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tytuł (opcjonalnie)"
            className={cn(NOTATNIK_INPUT_CLASS, "w-full text-sm font-semibold")}
          />
          <NoteFormatToolbar
            textareaRef={bodyTextareaRef}
            value={body}
            onChange={setBody}
            disabled={saving}
          />
          <textarea
            ref={bodyTextareaRef}
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              const el = e.currentTarget;
              if (
                handleNoteFormatKeyDown(e, body, el.selectionStart, el.selectionEnd, (next, start, end) => {
                  setBody(next);
                  requestAnimationFrame(() => el.setSelectionRange(start, end));
                })
              ) {
                return;
              }
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void save();
              }
            }}
            className={cn(NOTATNIK_TEXTAREA_CLASS, "min-h-[5.5rem] w-full resize-y text-sm leading-relaxed")}
          />
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
            <span className={cn(salesTypography.chrome, "text-slate-600")}>Przypomnij</span>
            <input
              type="date"
              value={followUpDraft}
              onChange={(e) => setFollowUpDraft(e.target.value)}
              className={cn(NOTATNIK_INPUT_CLASS, "h-8 w-auto text-xs")}
            />
          </div>
          <NoteColorPicker value={color} onChange={setColor} disabled={saving} size="sm" />
          <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
            <Button size="sm" disabled={saving} onClick={() => void save()}>
              {saving ? "Zapis…" : "Zapisz"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingState(false)}>
              Anuluj
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="relative px-2.5 pb-1 pt-3.5">
            {draggable && !readOnly ? (
              <span
                className="absolute left-1 top-2 cursor-grab text-slate-400 opacity-0 transition group-hover/sticky:opacity-100 active:cursor-grabbing"
                aria-hidden
                title="Przeciągnij, aby zmienić kolejność"
              >
                <IconGripVertical size={14} strokeWidth={2.5} />
              </span>
            ) : null}
            {displayTitle?.trim() ? (
              <h3 className="pr-4 text-[13px] font-bold leading-snug text-slate-900">{displayTitle}</h3>
            ) : null}
            <div className={cn(displayTitle?.trim() && "mt-1", "pr-1")}>
              <NoteBodyDisplay body={displayBody} />
            </div>
            {pinned && !readOnly ? (
              <span
                className="absolute right-1.5 top-2 text-indigo-600/80"
                title="Przypięta"
                aria-label="Przypięta"
              >
                <PinGlyph size={12} />
              </span>
            ) : null}
          </div>

          {!readOnly ? (
            <div className="mt-auto space-y-1 overflow-visible border-t border-slate-100 px-2.5 py-2">
              <NoteFollowUpControl
                value={followUpAt}
                onChange={changeFollowUp}
                saving={savingFollowUp}
              />
              <div className="space-y-1 overflow-visible py-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover/sticky:opacity-100 sm:group-focus-within/sticky:opacity-100">
                <NoteColorPicker
                  value={displayColor}
                  onChange={(c) => void changeColor(c)}
                  size="sm"
                />
                <NoteCardToolbar
                  pinned={pinned}
                  saving={saving || savingFollowUp}
                  onEdit={() => setEditingState(true)}
                  onTogglePin={() => void togglePin()}
                  onArchive={() => void archive()}
                />
              </div>
            </div>
          ) : followUpAt ? (
            <div className="mt-auto border-t border-slate-100 px-2.5 py-2">
              <NoteFollowUpControl value={followUpAt} onChange={() => {}} disabled />
            </div>
          ) : null}
        </>
      )}
      {error ? <p className="px-2.5 pb-2 text-[11px] text-red-700">{error}</p> : null}
      </article>
    </NoteStickyFrame>
  );
}

export function NotesSection({
  notes,
  readOnly,
  embedded,
  onNoteCreated,
  onNoteUpdated,
  onNoteArchived,
  onNotesReordered,
}: {
  notes: SalesNote[];
  readOnly?: boolean;
  embedded?: boolean;
  onNoteCreated?: (note: SalesNote) => void;
  onNoteUpdated?: (note: SalesNote) => void;
  onNoteArchived?: (note: SalesNote) => void;
  onNotesReordered?: (notes: SalesNote[], previousForUndo?: SalesNote[]) => void;
}) {
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
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const composeRef = useRef<HTMLDivElement>(null);
  const composeTextareaRef = useRef<HTMLTextAreaElement>(null);

  const composeExpanded =
    composeOpen || Boolean(draft.trim() || draftTitle.trim() || draftFollowUp);

  useEffect(() => {
    if (composeOpen) composeRef.current?.querySelector<HTMLElement>("textarea")?.focus();
  }, [composeOpen]);

  const sorted = sortSalesNotes(notes);
  const needle = searchQuery.trim();
  const filtered = useMemo(
    () => filterSalesNotesByQuery(sorted, searchQuery),
    [sorted, searchQuery]
  );

  const canDrag = !readOnly && !needle;

  const pinnedFiltered = filtered.filter((n) => n.pinned);
  const regularFiltered = filtered.filter((n) => !n.pinned);

  const toggleFocusedNotePin = useCallback(() => {
    if (!focusedNoteId) return;
    const note = notes.find((item) => item.id === focusedNoteId);
    if (!note) return;
    const nextPinned = !note.pinned;
    void actionUpdateSalesNote(note.id, { pinned: nextPinned })
      .then(() => onNoteUpdated?.({ ...note, pinned: nextPinned }))
      .catch(() => undefined);
  }, [focusedNoteId, notes, onNoteUpdated]);

  const persistReorder = useCallback(
    async (nextIds: string[] | null) => {
      if (!nextIds) {
        setError("Kolejność można zmieniać tylko w sekcji przypiętych lub zwykłych notatek.");
        return;
      }
      const prev = sortSalesNotes(notes);
      const optimistic = nextIds.map((id, index) => {
        const note = prev.find((n) => n.id === id)!;
        return { ...note, sort_order: index };
      });
      onNotesReordered?.(optimistic);
      try {
        await actionReorderSalesNotes(nextIds);
        onNotesReordered?.(optimistic, prev);
      } catch (e) {
        onNotesReordered?.(prev);
        setError(e instanceof Error ? e.message : "Nie udało się zmienić kolejności.");
      }
    },
    [notes, onNotesReordered]
  );

  function renderNoteCard(note: SalesNote) {
    const draggingNote = draggingId ? notes.find((n) => n.id === draggingId) : null;
    const startInEditMode = editingNoteId === note.id;

    return (
      <NoteCard
        key={`${note.id}:${note.updated_at}:${startInEditMode ? "edit" : "view"}`}
        note={note}
        anchorId={`note-${note.id}`}
        readOnly={readOnly}
        focused={focusedNoteId === note.id}
        startInEditMode={startInEditMode}
        onEditingChange={(editing) => {
          if (!editing && editingNoteId === note.id) setEditingNoteId(null);
        }}
        draggable={canDrag}
        isDragging={draggingId === note.id}
        dragOver={
          dragOverId === note.id &&
          draggingId !== note.id &&
          !!draggingNote &&
          notesInSamePinBand(draggingNote, note)
        }
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
          const nextIds = reorderNoteIds(notes, draggingId, note.id);
          setDraggingId(null);
          setDragOverId(null);
          void persistReorder(nextIds);
        }}
      />
    );
  }

  function renderNoteWallSection(list: SalesNote[], sectionLabel?: string) {
    if (!list.length) return null;

    return (
      <div className="space-y-3">
        {sectionLabel ? (
          <p className={cn(salesTypography.sectionLabel, "px-0.5")}>
            {sectionLabel}
          </p>
        ) : null}
        <div className={NOTATNIK_NOTES_GRID_CLASS}>{list.map((note) => renderNoteCard(note))}</div>
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
        setEditingNoteId(focusedNoteId);
        return;
      }

      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        toggleFocusedNotePin();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readOnly, filtered, focusedNoteId, toggleFocusedNotePin]);

  async function createNote() {
    const trimmed = draft.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      const { note } = await actionCreateSalesNote(trimmed, {
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
    <div className={embedded ? "space-y-0" : "space-y-3"}>
      {!embedded ? (
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className={salesTypography.blockTitle}>Notatki</h2>
            <KeyboardShortcutsHint items={[...NOTATNIK_KEYBOARD_HINTS]} className="mt-1" compact />
          </div>
        </div>
      ) : null}

      <div className={cn(embedded && "px-3 sm:px-4 pb-3 pt-3", !embedded && "space-y-3")}>
        {embedded ? (
          <KeyboardShortcutsHint items={[...NOTATNIK_KEYBOARD_HINTS]} compact />
        ) : null}

        <div className={cn(NOTATNIK_NOTES_WALL_CLASS, "space-y-3")}>
          {!readOnly ? (
            composeExpanded ? (
              <NoteStickyFrame seed="compose-new-note" straight showPin>
                <div
                  ref={composeRef}
                  className={noteStickyPaperClass(draftColor, { editing: true })}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      void createNote();
                    }
                  }}
                >
                  <div className="space-y-2 p-2.5 pt-3">
                    <p className={salesTypography.sectionLabel}>Nowa karteczka</p>
                    <input
                      type="text"
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      placeholder="Tytuł (opcjonalnie)"
                      className={cn(NOTATNIK_INPUT_CLASS, "w-full text-sm font-semibold")}
                    />
                    <NoteFormatToolbar
                      textareaRef={composeTextareaRef}
                      value={draft}
                      onChange={setDraft}
                      disabled={saving}
                    />
                    <textarea
                      ref={composeTextareaRef}
                      rows={3}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        const el = e.currentTarget;
                        if (
                          handleNoteFormatKeyDown(
                            e,
                            draft,
                            el.selectionStart,
                            el.selectionEnd,
                            (next, start, end) => {
                              setDraft(next);
                              requestAnimationFrame(() => el.setSelectionRange(start, end));
                            }
                          )
                        ) {
                          return;
                        }
                        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                          e.preventDefault();
                          void createNote();
                        }
                      }}
                      placeholder="Wpisz notatkę…"
                      className={cn(
                        NOTATNIK_TEXTAREA_CLASS,
                        "min-h-[5rem] w-full resize-y text-sm leading-relaxed"
                      )}
                    />
                    <div className="space-y-1.5 border-t border-slate-100 pt-2">
                      <span className={cn(salesTypography.chrome, "text-slate-600")}>Przypomnij</span>
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
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
                      <NoteColorPicker
                        value={draftColor}
                        onChange={setDraftColor}
                        disabled={saving}
                        size="sm"
                      />
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
                        <Button
                          size="sm"
                          disabled={saving || !draft.trim()}
                          onClick={() => void createNote()}
                        >
                          {saving ? "Zapis…" : "Dodaj"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </NoteStickyFrame>
            ) : (
              <NoteStickyFrame seed="compose-placeholder" straight={false}>
                <button
                  type="button"
                  onClick={() => setComposeOpen(true)}
                  className={cn(
                    noteStickyPaperClass("default", { placeholder: true }),
                    "flex min-h-[4.5rem] w-full items-center gap-2 px-3 py-3 text-left text-sm text-slate-500 transition hover:text-indigo-800"
                  )}
                >
                  <span className="text-lg leading-none text-indigo-600/80" aria-hidden>
                    +
                  </span>
                  Przypnij nową karteczkę…
                  <span className="ml-auto hidden sm:inline">
                    <KeyboardShortcutsHint items={[{ keys: ["N"], label: "" }]} compact />
                  </span>
                </button>
              </NoteStickyFrame>
            )
          ) : null}

          {notes.length > 0 ? (
            <NotatnikListFilterBar
              embedded
              value={searchQuery}
              onChange={setSearchQuery}
              matchCount={filtered.length}
              totalCount={notes.length}
              placeholder="Szukaj po tytule lub treści notatki…"
              searchLabel="Szukaj w notatkach"
              idleHint="Filtruj notatki po tytule lub treści."
              activeHint="Wyniki z przypiętych i zwykłych karteczek."
              emptyMatchHint="Brak dopasowań — sprawdź tytuł lub treść notatki."
            />
          ) : null}

          {canDrag && filtered.length > 1 ? (
            <p className="inline-flex flex-wrap items-center gap-1 text-[10px] text-slate-400">
              Przeciągnij karteczkę (
              <DragHandleGlyph />
              ) w sekcji przypiętych lub zwykłych — między sekcjami nie da się przenieść.
            </p>
          ) : null}

          {error ? <Alert tone="error">{error}</Alert> : null}

          {filtered.length === 0 ? (
            needle ? (
              <SalesListFilterEmptyHint
                query={searchQuery.trim()}
                onClear={() => setSearchQuery("")}
                entityLabel="notatek"
              />
            ) : (
              <SalesSectionEmptyHint message="Brak notatek — przypnij pierwszą karteczkę powyżej." />
            )
          ) : (
            <>
              {renderNoteWallSection(pinnedFiltered, pinnedFiltered.length ? "Przypięte" : undefined)}
              {pinnedFiltered.length > 0 && regularFiltered.length > 0 ? (
                <div className={cn("my-1", noteStickyBoardDividerClass)} aria-hidden />
              ) : null}
              {renderNoteWallSection(regularFiltered, pinnedFiltered.length ? "Pozostałe" : undefined)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
