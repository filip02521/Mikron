"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import {
  actionAttachZkWatchNoteToOpenProsba,
  actionUpdateZkWatchIncludeNoteInProsba,
  actionUpdateZkWatchNote,
} from "@/app/actions/sales-notepad";
import { IconNotepad } from "@/components/icons/StrokeIcons";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { polishPozycjeLabel } from "@/lib/email/polish-plural";
import { salesTypography } from "@/lib/ui/ontime-theme";
import { zkCaseNoteProsbaCalloutClassForTone } from "@/lib/ui/zk-case-note-prosba-styles";
import {
  ZK_MODAL_SECTION_HINTS,
  ZK_MODAL_SECTION_TITLES,
} from "@/lib/sales/zk-modal-section-copy";
import {
  deriveZkCaseNotePendingAttachKind,
  deriveZkCaseNoteProsbaStatus,
  normalizeZkCaseNote,
  openZkLinkedOrdersWithCaseNoteState,
  zkCaseNoteAttachActionLabel,
  zkCaseNoteProsbaStatusCopy,
  zkCaseNoteWithoutNoteCountLabel,
  type ZkCaseNoteProsbaStatus,
} from "@/lib/sales/zk-watch-case-note-prosba";
import type { ZkLinkableOrder } from "@/lib/sales/zk-watch-order-link";
import type { SalesZkWatch } from "@/types/database";
import { ZkCaseNoteProsbaChip } from "./ZkCaseNoteProsbaChip";
import { NOTATNIK_TEXTAREA_CLASS } from "./notatnik-layout";
import { ZkWatchModalSection } from "./ZkWatchModalSection";

const INCLUDE_HINT: Record<ZkCaseNoteProsbaStatus, string | null> = {
  none: null,
  private:
    "Włącz, żeby zakupy widziały notatkę w uwagach pozycji przy następnej prośbie.",
  planned:
    "Przy zapisie notatki treść trafi do nowej lub uzupełnianej prośby.",
  planned_pending_attach:
    "Masz otwartą prośbę — możesz dodać lub zaktualizować notatkę od razu.",
  in_prosba:
    "Notatka jest już w prośbie. Edycja zaktualizuje uwagi tam, gdzie to bezpieczne.",
};

export function ZkWatchNoteSection({
  watch,
  linkableOrders = [],
  readOnly,
  tourPreview = false,
  archived,
  focusNote = false,
  onSaved,
}: {
  watch: SalesZkWatch;
  linkableOrders?: ZkLinkableOrder[];
  readOnly?: boolean;
  tourPreview?: boolean;
  archived?: boolean;
  focusNote?: boolean;
  onSaved?: (watch: SalesZkWatch) => void;
}) {
  const router = useRouter();
  const watchMetaKey = `${watch.id}\0${watch.note ?? ""}\0${Boolean(
    watch.include_note_in_prosba
  )}\0${focusNote}`;
  const [appliedWatchMetaKey, setAppliedWatchMetaKey] = useState(watchMetaKey);
  const [noteOpen, setNoteOpen] = useState(focusNote);
  const [noteDraft, setNoteDraft] = useState(watch.note ?? "");
  const [savedWatch, setSavedWatch] = useState(watch);
  /** Po sync / „Dodaj teraz” — od razu odśwież status, zanim wróci router.refresh. */
  const [attachedNoteByOrderId, setAttachedNoteByOrderId] = useState<
    Record<string, string | null>
  >({});
  const [savingNote, setSavingNote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pendingFlag, startFlag] = useTransition();

  if (watchMetaKey !== appliedWatchMetaKey) {
    setAppliedWatchMetaKey(watchMetaKey);
    setNoteDraft(watch.note ?? "");
    setSavedWatch(watch);
    setNoteOpen(focusNote);
    const nextNote = normalizeZkCaseNote(watch.note);
    setAttachedNoteByOrderId((prev) => {
      if (!Object.keys(prev).length) return prev;
      const kept: Record<string, string | null> = {};
      for (const [id, note] of Object.entries(prev)) {
        if (note === nextNote) kept[id] = note;
      }
      return kept;
    });
    setError(null);
    setInfo(null);
  }

  const canEdit = !readOnly && !tourPreview && !archived;
  const savedNote = savedWatch.note ?? "";
  const hasSavedNote = Boolean(savedNote.trim());
  const includeInProsba = Boolean(savedWatch.include_note_in_prosba);

  const effectiveLinkableOrders = useMemo(() => {
    if (!Object.keys(attachedNoteByOrderId).length) return linkableOrders;
    return linkableOrders.map((order) => {
      if (!(order.id in attachedNoteByOrderId)) return order;
      return { ...order, sales_request_note: attachedNoteByOrderId[order.id] };
    });
  }, [attachedNoteByOrderId, linkableOrders]);

  const noteProsbaState = useMemo(
    () => openZkLinkedOrdersWithCaseNoteState(savedWatch, effectiveLinkableOrders),
    [savedWatch, effectiveLinkableOrders]
  );

  const pendingKind = deriveZkCaseNotePendingAttachKind(noteProsbaState.withoutNote);
  const status = deriveZkCaseNoteProsbaStatus({
    note: savedNote,
    includeNoteInProsba: includeInProsba,
    openOrderCount: noteProsbaState.openOrders.length,
    openOrdersWithMatchingNoteCount: noteProsbaState.withNote.length,
  });
  const statusCopy = zkCaseNoteProsbaStatusCopy(status, pendingKind);

  function commitWatch(next: SalesZkWatch) {
    setSavedWatch(next);
    onSaved?.(next);
  }

  function patchAttachedOrders(orderIds: string[], note: string | null) {
    if (!orderIds.length) return;
    setAttachedNoteByOrderId((prev) => {
      const next = { ...prev };
      for (const id of orderIds) next[id] = note;
      return next;
    });
  }

  function refreshOrdersAfterSync() {
    router.refresh();
  }

  async function saveNote() {
    if (!canEdit || savingNote) return;
    setSavingNote(true);
    setError(null);
    setInfo(null);
    try {
      const result = await actionUpdateZkWatchNote(savedWatch.id, noteDraft);
      const next = result.watch;
      setNoteDraft(next.note ?? "");
      commitWatch(next);
      if (result.syncedOrderIds?.length) {
        patchAttachedOrders(result.syncedOrderIds, normalizeZkCaseNote(next.note));
        refreshOrdersAfterSync();
      }
      setNoteOpen(false);
      if (result.message) setInfo(result.message);
    } catch (e) {
      setError(userFacingErrorText(e, "Nie udało się zapisać notatki."));
    } finally {
      setSavingNote(false);
    }
  }

  function setIncludeInProsba(next: boolean) {
    if (!canEdit || pendingFlag) return;
    if (next && !hasSavedNote) {
      setError("Najpierw zapisz notatkę do sprawy.");
      setNoteOpen(true);
      return;
    }
    setError(null);
    setInfo(null);
    startFlag(async () => {
      try {
        const result = await actionUpdateZkWatchIncludeNoteInProsba(
          savedWatch.id,
          next
        );
        commitWatch(result.watch);
        if (next && result.syncedOrderIds?.length) {
          patchAttachedOrders(
            result.syncedOrderIds,
            normalizeZkCaseNote(result.watch.note)
          );
          refreshOrdersAfterSync();
        }
        setInfo(
          next
            ? result.syncedOpenProsbaCount > 0 && result.pendingOpenProsbaCount === 0
              ? `Włączono i uzupełniono uwagi w prośbie (${polishPozycjeLabel(result.syncedOpenProsbaCount)}). Zakupy widzą notatkę.`
              : result.syncedOpenProsbaCount > 0
                ? "Włączono i uzupełniono puste uwagi. Pozostały pozycje z inną treścią — możesz je zaktualizować."
                : noteProsbaState.openOrders.length > 0 &&
                    noteProsbaState.withoutNote.length > 0
                  ? "Włączono dołączanie. Możesz od razu dodać / zaktualizować notatkę w otwartej prośbie."
                  : "Włączono — notatka trafi do nowej / uzupełnianej prośby. Zmiany notatki zaktualizują też otwarte prośby."
            : "Wyłączono — notatka zostaje tylko u Ciebie. Treść już w otwartych prośbach zostaje (zakupy nadal ją widzą), dopóki jej nie zmienisz / nie usuniesz."
        );
      } catch (e) {
        setError(
          userFacingErrorText(e, "Nie udało się zapisać ustawienia notatki.")
        );
      }
    });
  }

  function attachToOpenProsba() {
    if (!canEdit || pendingFlag) return;
    if (pendingKind === "stale" || pendingKind === "mixed") {
      const ok = window.confirm(
        pendingKind === "stale"
          ? "Na otwartych pozycjach jest inna treść uwag (mogła pochodzić od zakupów). Nadpisać ją notatką ze sprawy ZK?"
          : "Część otwartych pozycji ma inną treść uwag. Nadpisać je notatką ze sprawy ZK?"
      );
      if (!ok) return;
    }
    setError(null);
    setInfo(null);
    const pendingIds = noteProsbaState.withoutNote.map((o) => o.id);
    const caseNote = normalizeZkCaseNote(savedNote);
    startFlag(async () => {
      try {
        const result = await actionAttachZkWatchNoteToOpenProsba(savedWatch.id);
        commitWatch(result.watch);
        if (caseNote && pendingIds.length > 0 && result.updatedCount > 0) {
          patchAttachedOrders(pendingIds, caseNote);
          refreshOrdersAfterSync();
        }
        setInfo(result.message);
      } catch (e) {
        setError(
          userFacingErrorText(e, "Nie udało się dodać notatki do prośby.")
        );
      }
    });
  }

  const showAttachNow =
    canEdit &&
    hasSavedNote &&
    noteProsbaState.withoutNote.length > 0 &&
    (includeInProsba || status === "private" || status === "planned_pending_attach");

  const attachLabel = zkCaseNoteAttachActionLabel(pendingKind);

  return (
    <ZkWatchModalSection
      title={ZK_MODAL_SECTION_TITLES.note}
      hint={ZK_MODAL_SECTION_HINTS.note}
    >
      <div
        className={cn(
          "mb-2.5 flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3",
          status !== "none" && zkCaseNoteProsbaCalloutClassForTone(statusCopy.tone)
        )}
      >
        {status !== "none" ? (
          <>
            <ZkCaseNoteProsbaChip
              status={status}
              pendingKind={pendingKind}
              variant="modal"
              className="shrink-0"
            />
            <p className={cn(salesTypography.rowMeta, "min-w-0 text-slate-600")}>
              {statusCopy.description}
            </p>
          </>
        ) : (
          <p className={cn(salesTypography.rowMeta, "text-slate-500")}>
            {statusCopy.description}
          </p>
        )}
      </div>

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
          {includeInProsba && noteProsbaState.openOrders.length > 0 ? (
            <p className={cn(salesTypography.rowMeta, "text-amber-900/90")}>
              Masz włączone „Dołącz do prośby” — zapis zaktualizuje uwagi w otwartej
              prośbie (tam, gdzie była poprzednia treść ze sprawy ZK albo brak uwag).
            </p>
          ) : null}
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

      {hasSavedNote && canEdit ? (
        <div className="mt-3 space-y-2 rounded-lg border border-slate-200/90 bg-slate-50/70 px-3 py-2.5">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              checked={includeInProsba}
              disabled={pendingFlag}
              onChange={(e) => setIncludeInProsba(e.target.checked)}
            />
            <span className="min-w-0">
              <span className={cn(salesTypography.rowBody, "font-medium text-slate-800")}>
                Dołącz do prośby
              </span>
              <span className={cn(salesTypography.rowMeta, "mt-0.5 block text-slate-500")}>
                {INCLUDE_HINT[status] ??
                  "Zakupy zobaczą tę treść w uwagach pozycji przy tworzeniu lub uzupełnianiu prośby."}
              </span>
            </span>
          </label>

          {showAttachNow ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-200/80 pt-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={pendingFlag}
                onClick={() => attachToOpenProsba()}
              >
                {pendingFlag ? "Zapisywanie…" : attachLabel}
              </Button>
              <span className={cn(salesTypography.rowMeta, "text-slate-500")}>
                {zkCaseNoteWithoutNoteCountLabel(noteProsbaState.withoutNote.length)}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {info ? (
        <p className="mt-2 text-xs font-medium text-emerald-700">{info}</p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </ZkWatchModalSection>
  );
}
