"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  actionArchiveOperationsNote,
  actionCreateOperationsNote,
  actionReorderOperationsNotes,
  actionUpdateOperationsNote,
} from "@/app/actions/operations-notepad";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { KeyboardShortcutsHint } from "@/components/ui/KeyboardShortcutsHint";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { IconPlusCircle } from "@/components/icons/StrokeIcons";
import { NOTATNIK_NOTES_SEARCH_PLACEHOLDER, NOTATNIK_NOTES_SECTION_COPY } from "@/lib/sales/notatnik-notes-copy";
import { SalesListFilterEmptyHint, SalesSectionEmptyHint } from "@/components/sales/SalesListEmptyHints";
import { cn } from "@/lib/cn";
import { notatnikAddPanelShellClass, notatnikPrimaryAddButtonClass, panelTypography, salesTypography } from "@/lib/ui/ontime-theme";
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
import { flashNotepadAnchor } from "@/lib/sales/notepad-anchor";
import { NoteColorPicker, NoteCardToolbar } from "@/components/notatnik/NoteColorPicker";
import { NotatnikListFilterBar } from "@/components/notatnik/NotatnikListFilterBar";
import { NoteFollowUpControl } from "@/components/notatnik/NoteFollowUpControl";
import { FollowUpQuickDates } from "@/components/notatnik/FollowUpQuickDates";
import {
  NOTATNIK_INPUT_CLASS,
  NOTATNIK_NOTES_GRID_CLASS,
  NOTATNIK_NOTES_WALL_CLASS,
} from "@/components/notatnik/notatnik-layout";
import { noteStickyBoardDividerClass, noteStickyPaperClass } from "@/components/notatnik/note-styles";
import { NoteStickyFrame } from "@/components/notatnik/NoteStickyFrame";
import { DragHandleGlyph, PinGlyph } from "@/components/ui/UiGlyphs";
import { IconGripVertical } from "@/components/icons/StrokeIcons";
import { RichNoteEditor } from "@/components/notatnik/RichNoteEditor";
import { NoteBodyDisplay } from "@/components/notatnik/NoteBodyDisplay";

export const NOTATNIK_KEYBOARD_HINTS = [
  { keys: ["N"], label: "nowa notatka" },
  { keys: ["/"], label: "szukaj" },
  { keys: ["↑", "↓"], label: "fokus karty" },
  { keys: ["E"], label: "edytuj" },
  { keys: ["P"], label: "przypnij" },
  { keys: ["Ctrl", "B"], label: "pogrubienie" },
  { keys: ["Ctrl", "I"], label: "kursywa" },
  { keys: ["Ctrl", "Enter"], label: "zapisz" },
  { keys: ["Ctrl", "Z"], label: "cofnij" },
] as const;

const NoteCard = memo(function NoteCard({
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
  const [active, setActive] = useState(false);
  const [body, setBody] = useState(note.body);
  const [title, setTitle] = useState(note.title ?? "");
  const [color, setColor] = useState(note.color);
  const [pinned, setPinned] = useState(note.pinned);
  const [followUpAt, setFollowUpAt] = useState<string | null>(note.follow_up_at?.slice(0, 10) ?? null);
  const [saving, setSaving] = useState(false);
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasChangesRef = useRef(false);

  if (noteSyncKey !== appliedNoteSyncKey) {
    setAppliedNoteSyncKey(noteSyncKey);
    setBody(note.body);
    setTitle(note.title ?? "");
    setColor(note.color);
    setPinned(note.pinned);
    const iso = note.follow_up_at?.slice(0, 10) ?? null;
    setFollowUpAt(iso);
  }

  const pendingKey = pendingKeyboardAction ? `${note.id}:${pendingKeyboardAction}` : null;
  const [handledPendingKey, setHandledPendingKey] = useState<string | null>(null);
  if (pendingKey && pendingKey !== handledPendingKey && !readOnly) {
    setHandledPendingKey(pendingKey);
    onConsumeKeyboardAction?.();
    if (pendingKeyboardAction === "edit") {
      setActive(true);
      setTimeout(() => {
        document.querySelector<HTMLElement>(`#note-${note.id} .rich-note-editor`)?.focus();
      }, 0);
    } else if (pendingKeyboardAction === "pin") {
      const nextPinned = !pinned;
      setPinned(nextPinned);
      void actionUpdateOperationsNote(note.id, { pinned: nextPinned })
        .then(() => onUpdated?.({ ...note, pinned: nextPinned }))
        .catch(() => setPinned(!nextPinned));
    }
  }

  async function save() {
    if (!hasChangesRef.current) return;
    hasChangesRef.current = false;
    setSaving(true);
    setError(null);
    try {
      await actionUpdateOperationsNote(note.id, {
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
  const displayColor = color;
  const straightFrame = active || focused || isDragging;

  return (
    <NoteStickyFrame seed={note.id} straight={straightFrame} showPin={pinned && !active}>
      <article
        id={anchorId}
        tabIndex={focused ? 0 : -1}
        draggable={draggable && !active}
        onDragStart={(e) => {
          if (!draggable || active) return;
          e.dataTransfer.effectAllowed = "move";
          onDragStart?.();
        }}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onFocus={onFocus}
        className={cn(
          anchorId && "scroll-mt-6 scroll-mb-6",
          noteStickyPaperClass(displayColor, {
            pinned,
            followUpDue,
            focused,
            dragOver,
            isDragging,
            editing: active,
          }),
          "transition-all duration-200 ease-out",
          active ? "pb-3" : "pb-1"
        )}
      >
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
          {readOnly ? (
            note.title?.trim() ? (
              <h3 className="pr-4 text-[13px] font-bold leading-snug text-slate-900">{note.title}</h3>
            ) : null
          ) : (
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                hasChangesRef.current = true;
              }}
              onBlur={() => void save()}
              placeholder="Tytuł (opcjonalnie)"
              className="w-full bg-transparent pr-4 text-[13px] font-bold leading-snug text-slate-900 outline-none placeholder:text-slate-400/70"
            />
          )}
          {showAuthor && note.author?.email ? (
            <p className="mb-0.5 mt-0.5 text-[10px] text-slate-500">{note.author.email}</p>
          ) : null}
          <div className={cn("mt-1 pr-1")}>
            {readOnly ? (
              <NoteBodyDisplay body={note.body} />
            ) : (
              <RichNoteEditor
                value={body}
                onChange={(md) => {
                  setBody(md);
                  hasChangesRef.current = true;
                }}
                onSave={() => void save()}
                onActiveChange={setActive}
                editable={!readOnly}
                placeholder="Wpisz notatkę…"
              />
            )}
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
                onEdit={() => setActive(true)}
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
        {error ? <p className="px-2.5 pb-2 text-[11px] text-red-700">{error}</p> : null}
      </article>
    </NoteStickyFrame>
  );
});

export function OperationsNotesSection({
  notes,
  department,
  visibility,
  currentUserId,
  readOnly,
  embedded,
  focusNoteId,
  onFocusNoteHandled,
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
  focusNoteId?: string | null;
  onFocusNoteHandled?: (noteId: string) => void;
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
  const focusFlashHandledRef = useRef<string | null>(null);

  const scrollFocusedNoteIntoView = useCallback((noteId: string) => {
    document.getElementById(`note-${noteId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, []);

  const composeExpanded =
    composeOpen || Boolean(draft.trim() || draftTitle.trim() || draftFollowUp);

  useEffect(() => {
    if (composeOpen) composeRef.current?.querySelector<HTMLElement>(".rich-note-editor")?.focus();
  }, [composeOpen]);

  useEffect(() => {
    if (!focusNoteId || !notes.some((note) => note.id === focusNoteId)) return;
    if (focusFlashHandledRef.current === focusNoteId) return;
    setFocusedNoteId(focusNoteId);
    flashNotepadAnchor(`note-${focusNoteId}`, {
      onFound: () => {
        document.getElementById(`note-${focusNoteId}`)?.focus({ preventScroll: true });
        focusFlashHandledRef.current = focusNoteId;
        onFocusNoteHandled?.(focusNoteId);
      },
    });
  }, [focusNoteId, notes, onFocusNoteHandled]);

  useEffect(() => {
    if (!focusNoteId) {
      focusFlashHandledRef.current = null;
    }
  }, [focusNoteId]);

  const sorted = useMemo(() => sortOperationsNotes(notes), [notes]);
  const needle = searchQuery.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      needle
        ? sorted.filter(
            (note) =>
              note.body.toLowerCase().includes(needle) ||
              note.title?.toLowerCase().includes(needle)
          )
        : sorted,
    [sorted, needle]
  );

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
      <div className="space-y-3">
        {sectionLabel ? (
          <p className={cn(salesTypography.sectionLabel, "px-0.5")}>
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
    if (readOnly) return;

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inField = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ||
        (e.target as HTMLElement)?.isContentEditable;

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
        const nextId = filtered[nextIdx]!.id;
        setFocusedNoteId(nextId);
        scrollFocusedNoteIntoView(nextId);
        document.getElementById(`note-${nextId}`)?.focus({ preventScroll: true });
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        const nextIdx = idx < 0 ? 0 : Math.max(idx - 1, 0);
        const nextId = filtered[nextIdx]!.id;
        setFocusedNoteId(nextId);
        scrollFocusedNoteIntoView(nextId);
        document.getElementById(`note-${nextId}`)?.focus({ preventScroll: true });
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
  }, [readOnly, filtered, focusedNoteId, scrollFocusedNoteIntoView]);

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
          <h2 className={panelTypography.sectionTitle}>Notatki</h2>
        </div>
      ) : null}

        <div className={cn(NOTATNIK_NOTES_WALL_CLASS, "space-y-3", embedded && "px-3 sm:px-4")}>

      {canCompose ? (
        composeExpanded ? (
          <div className={notatnikAddPanelShellClass}>
            <div className="flex items-start justify-between gap-2 border-b border-indigo-100/80 px-3 py-2.5 sm:px-3.5">
              <div className="flex min-w-0 items-start gap-2.5">
                <SectionHeadingIcon
                  tileClassName="bg-indigo-100 text-indigo-800"
                  className="mt-0.5 h-8 w-8"
                >
                  <IconPlusCircle size={17} strokeWidth={2.25} />
                </SectionHeadingIcon>
                <div className="min-w-0">
                  <p className={cn(salesTypography.sectionLabel, "normal-case text-indigo-950")}>
                    Nowa karteczka
                  </p>
                  <p className={cn("mt-0.5", salesTypography.sectionHint, "text-indigo-950/75")}>
                    {NOTATNIK_NOTES_SECTION_COPY.hint}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-9 shrink-0 text-indigo-800 hover:bg-indigo-100/80"
                onClick={() => {
                  setDraft("");
                  setDraftTitle("");
                  setDraftFollowUp("");
                  setDraftColor("default");
                  setComposeOpen(false);
                }}
              >
                Zwiń
              </Button>
            </div>
            <div className="px-3 py-3 sm:px-3.5">
              <NoteStickyFrame seed="compose-ops-note" straight showPin>
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
                    <input
                      type="text"
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      placeholder="Tytuł (opcjonalnie)"
                      className={cn(NOTATNIK_INPUT_CLASS, "w-full text-sm font-semibold")}
                    />
                    <RichNoteEditor
                      value={draft}
                      onChange={setDraft}
                      onSave={() => void createNote()}
                      saveOnBlur={false}
                      editable={!saving}
                      placeholder="Wpisz notatkę…"
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
              </NoteStickyFrame>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className={notatnikPrimaryAddButtonClass}
            onClick={() => setComposeOpen(true)}
          >
            <IconPlusCircle size={16} strokeWidth={2} className="mr-1.5 shrink-0" aria-hidden />
            Przypnij nową karteczkę
            <span className="ml-2 hidden sm:inline-flex">
              <KeyboardShortcutsHint items={[{ keys: ["N"], label: "" }]} compact />
            </span>
          </Button>
        )
      ) : null}

      {notes.length > 0 ? (
        <div className={cn(!readOnly && "mt-3")}>
          <NotatnikListFilterBar
            embedded
            bleed
            visibleLabel="Szukaj w notatkach"
            value={searchQuery}
            onChange={setSearchQuery}
            matchCount={filtered.length}
            totalCount={notes.length}
            placeholder={NOTATNIK_NOTES_SEARCH_PLACEHOLDER}
            searchLabel="Szukaj w notatkach"
            showIdleHint={false}
            showActiveDetail={false}
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
        needle ? (
          <SalesListFilterEmptyHint
            query={searchQuery.trim()}
            onClear={() => setSearchQuery("")}
            entityLabel="notatek"
          />
        ) : readOnly ? (
          <SalesSectionEmptyHint message="Brak notatek." />
        ) : null
      ) : (
        <>
          {renderNoteGrid(pinnedFiltered, pinnedFiltered.length ? "Przypięte" : undefined)}
          {pinnedFiltered.length > 0 && regularFiltered.length > 0 ? (
            <div className={cn("my-1", noteStickyBoardDividerClass)} aria-hidden />
          ) : null}
          {renderNoteGrid(regularFiltered, pinnedFiltered.length ? "Pozostałe" : undefined)}
        </>
      )}
        </div>
    </div>
  );
}
