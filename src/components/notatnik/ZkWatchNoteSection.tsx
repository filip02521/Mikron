"use client";

import { useState } from "react";
import { actionUpdateZkWatchNote } from "@/app/actions/sales-notepad";
import { IconNotepad } from "@/components/icons/StrokeIcons";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";
import { ZK_MODAL_SECTION_HINTS, ZK_MODAL_SECTION_TITLES } from "@/lib/sales/zk-modal-section-copy";
import type { SalesZkWatch } from "@/types/database";
import { NOTATNIK_TEXTAREA_CLASS } from "./notatnik-layout";
import { ZkWatchModalSection } from "./ZkWatchModalSection";

export function ZkWatchNoteSection({
  watch,
  readOnly,
  tourPreview = false,
  archived,
  focusNote = false,
  onSaved,
}: {
  watch: SalesZkWatch;
  readOnly?: boolean;
  tourPreview?: boolean;
  archived?: boolean;
  focusNote?: boolean;
  onSaved?: (watch: SalesZkWatch) => void;
}) {
  const watchMetaKey = `${watch.id}\0${watch.note ?? ""}\0${focusNote}`;
  const [appliedWatchMetaKey, setAppliedWatchMetaKey] = useState(watchMetaKey);
  const [noteOpen, setNoteOpen] = useState(focusNote);
  const [noteDraft, setNoteDraft] = useState(watch.note ?? "");
  const [savedNote, setSavedNote] = useState(watch.note ?? "");
  const [savingNote, setSavingNote] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (watchMetaKey !== appliedWatchMetaKey) {
    setAppliedWatchMetaKey(watchMetaKey);
    setNoteDraft(watch.note ?? "");
    setSavedNote(watch.note ?? "");
    setNoteOpen(focusNote);
    setError(null);
  }

  const canEdit = !readOnly && !tourPreview && !archived;
  const hasSavedNote = Boolean(savedNote.trim());

  async function saveNote() {
    if (!canEdit || savingNote) return;
    setSavingNote(true);
    setError(null);
    try {
      await actionUpdateZkWatchNote(watch.id, noteDraft);
      const trimmed = noteDraft.trim();
      setSavedNote(trimmed);
      setNoteOpen(false);
      onSaved?.({ ...watch, note: trimmed });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać notatki.");
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <ZkWatchModalSection title={ZK_MODAL_SECTION_TITLES.note} hint={ZK_MODAL_SECTION_HINTS.note}>
      {noteOpen && canEdit ? (
        <div className="space-y-2 rounded-lg border border-indigo-200/80 bg-indigo-50/35 p-3">
          <textarea
            rows={3}
            value={noteDraft}
            disabled={savingNote}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Np. klient dzwonił w poniedziałek, czeka na potwierdzenie dostępności…"
            className={cn(NOTATNIK_TEXTAREA_CLASS, "w-full bg-white")}
            autoFocus={focusNote}
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={savingNote} onClick={() => void saveNote()}>
              {savingNote ? "Zapis…" : "Zapisz notatkę"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setNoteDraft(savedNote);
                setNoteOpen(false);
              }}
            >
              Anuluj
            </Button>
          </div>
        </div>
      ) : hasSavedNote ? (
        <div className="rounded-lg border border-slate-200/90 bg-white px-3 py-2.5 shadow-[var(--shadow-card)]">
          <p className="text-sm leading-relaxed text-slate-700">{savedNote}</p>
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mt-2.5"
              onClick={() => setNoteOpen(true)}
            >
              Edytuj notatkę
            </Button>
          ) : null}
        </div>
      ) : canEdit ? (
        <div className="rounded-lg border border-dashed border-indigo-200/90 bg-indigo-50/25 px-3 py-3 sm:px-4 sm:py-3.5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200/80">
              <IconNotepad size={16} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn(salesTypography.rowBody, "font-medium text-slate-800")}>
                Brak notatki
              </p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="mt-2.5"
                onClick={() => setNoteOpen(true)}
              >
                Dodaj notatkę
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <p className={cn(salesTypography.rowMeta, "text-slate-500")}>Brak notatki.</p>
      )}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </ZkWatchModalSection>
  );
}
