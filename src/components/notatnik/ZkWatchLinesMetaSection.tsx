"use client";

import { useEffect, useState } from "react";
import { actionUpdateZkWatchNote } from "@/app/actions/sales-notepad";
import { Button } from "@/components/ui/Button";
import { HelpMenuGlyph } from "@/components/ui/UiGlyphs";
import { cn } from "@/lib/cn";
import { brandLinkSubtleClass, salesTypography } from "@/lib/ui/ontime-theme";
import {
  formatPln,
  formatShortDate,
  zkWatchStatusLabel,
  zkWatchSubtitle,
} from "@/lib/sales/notepad-format";
import {
  extractZkWatchClientContact,
  normalizePhoneHref,
} from "@/lib/sales/zk-watch-contact";
import type { SalesZkWatch } from "@/types/database";
import { NOTATNIK_TEXTAREA_CLASS } from "./notatnik-layout";
import { ZkWatchModalSection } from "./ZkWatchModalSection";

function MetaFact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className={salesTypography.sectionLabel}>{label}</p>
      <div className={cn("mt-0.5", salesTypography.rowBody, "text-slate-800")}>{children}</div>
    </div>
  );
}

export function ZkWatchLinesMetaSection({
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
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(watch.note ?? "");
  const [savedNote, setSavedNote] = useState(watch.note ?? "");
  const [savingNote, setSavingNote] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = !readOnly && !tourPreview && !archived;
  const clientContact = extractZkWatchClientContact(watch);
  const subiektStatus = zkWatchStatusLabel(watch);
  const isRealizedInSubiekt = subiektStatus === "Zrealizowane";
  const issued = formatShortDate(watch.zk_issued_at);
  const subtitle = zkWatchSubtitle(watch, { omitLineSummary: true });

  useEffect(() => {
    setNoteDraft(watch.note ?? "");
    setSavedNote(watch.note ?? "");
    setNoteOpen(focusNote);
    setError(null);
  }, [watch, focusNote]);

  async function saveNote() {
    if (!canEdit || savingNote) return;
    setSavingNote(true);
    setError(null);
    try {
      await actionUpdateZkWatchNote(watch.id, noteDraft);
      const trimmed = noteDraft.trim();
      setSavedNote(trimmed);
      setNoteOpen(Boolean(trimmed));
      onSaved?.({ ...watch, note: trimmed });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać notatki.");
    } finally {
      setSavingNote(false);
    }
  }

  const hasContact = Boolean(clientContact.phone || clientContact.email);
  const hasFacts = hasContact || issued || watch.amount_gross != null || Boolean(subtitle);

  return (
    <ZkWatchModalSection
      title="Szczegóły"
      hint="Kontakt, kwota i notatka do tej sprawy ZK."
    >
      {hasFacts ? (
        <div className="rounded-md border border-slate-200/90 bg-slate-50/50 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {clientContact.phone ? (
              <MetaFact label="Telefon">
                <a href={normalizePhoneHref(clientContact.phone)} className={brandLinkSubtleClass}>
                  {clientContact.phone}
                </a>
              </MetaFact>
            ) : null}
            {clientContact.email ? (
              <MetaFact label="E-mail">
                <a href={`mailto:${clientContact.email}`} className={brandLinkSubtleClass}>
                  {clientContact.email}
                </a>
              </MetaFact>
            ) : null}
            {issued ? <MetaFact label="Wystawiono">{issued}</MetaFact> : null}
            {watch.amount_gross != null ? (
              <MetaFact label="Kwota">{formatPln(watch.amount_gross)}</MetaFact>
            ) : null}
          </div>
          {subtitle ? (
            <p className={cn("mt-2 border-t border-slate-200/70 pt-2", salesTypography.rowMeta)}>
              {subtitle}
            </p>
          ) : null}
          {archived && watch.closed_at ? (
            <p className={cn("mt-2", salesTypography.rowMeta)}>
              Zamknięto {formatShortDate(watch.closed_at)}
            </p>
          ) : null}
        </div>
      ) : null}

      {isRealizedInSubiekt && canEdit ? (
        <p className="rounded-md border border-emerald-200/80 bg-emerald-50/70 px-3 py-2 text-xs leading-snug text-emerald-900">
          Subiekt: Zrealizowane — rozważ zamknięcie sprawy (menu{" "}
          <HelpMenuGlyph className="align-[-2px]" />
          ).
        </p>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className={salesTypography.sectionLabel}>Notatka</p>
          {canEdit && !noteOpen ? (
            <button
              type="button"
              className="text-xs font-medium text-indigo-700 hover:text-indigo-900"
              onClick={() => setNoteOpen(true)}
            >
              {savedNote.trim() ? "Edytuj" : "Dodaj"}
            </button>
          ) : null}
        </div>
        {noteOpen && canEdit ? (
          <div className="space-y-2">
            <textarea
              rows={3}
              value={noteDraft}
              disabled={savingNote}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Notatka do sprawy ZK…"
              className={cn(NOTATNIK_TEXTAREA_CLASS, "w-full")}
              autoFocus={focusNote}
            />
            <div className="flex gap-2">
              <Button size="sm" disabled={savingNote} onClick={() => void saveNote()}>
                {savingNote ? "Zapis…" : "Zapisz notatkę"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setNoteDraft(savedNote);
                  setNoteOpen(Boolean(savedNote.trim()));
                }}
              >
                Anuluj
              </Button>
            </div>
          </div>
        ) : savedNote.trim() ? (
          <p className="text-xs leading-relaxed text-slate-600">{savedNote}</p>
        ) : null}
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </ZkWatchModalSection>
  );
}
