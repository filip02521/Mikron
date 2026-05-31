"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  actionRefreshZkWatchFromSubiekt,
  actionRestoreZkWatch,
  actionCloseZkWatch,
  actionDeleteArchivedZkWatch,
  actionUpdateZkWatchFollowUp,
  actionUpdateZkWatchNote,
} from "@/app/actions/sales-notepad";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
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
import {
  buildMojeClientLink,
  formatFollowUpLabel,
  isFollowUpDue,
} from "@/lib/sales/notepad-follow-up";
import {
  prosbaHrefFromZkWatch,
  stashZkProsbaPrefill,
} from "@/lib/orders/zk-watch-prosba-prefill";
import type { SalesZkWatch } from "@/types/database";
import { FollowUpQuickDates } from "./FollowUpQuickDates";
import {
  NOTATNIK_INPUT_CLASS,
  NOTATNIK_TEXTAREA_CLASS,
} from "./notatnik-layout";

export function ZkWatchCard({
  watch,
  readOnly,
  tourPreview = false,
  onClosed,
  onRestored,
  onRefreshed,
  onDeleted,
  archived,
  compact,
  subiektReachable = true,
}: {
  watch: SalesZkWatch;
  readOnly?: boolean;
  tourPreview?: boolean;
  onClosed?: () => void;
  onRestored?: (watch: SalesZkWatch) => void;
  onRefreshed?: (watch: SalesZkWatch) => void;
  onDeleted?: () => void;
  archived?: boolean;
  compact?: boolean;
  subiektReachable?: boolean;
}) {
  const [closing, setClosing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [noteOpen, setNoteOpen] = useState(Boolean(watch.note?.trim()));
  const [noteDraft, setNoteDraft] = useState(watch.note ?? "");
  const [savedNote, setSavedNote] = useState(watch.note ?? "");
  const [savingNote, setSavingNote] = useState(false);
  const [followUpDraft, setFollowUpDraft] = useState(watch.follow_up_at?.slice(0, 10) ?? "");
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNoteDraft(watch.note ?? "");
    setSavedNote(watch.note ?? "");
    setNoteOpen(Boolean(watch.note?.trim()));
    setFollowUpDraft(watch.follow_up_at?.slice(0, 10) ?? "");
  }, [watch.id, watch.note, watch.follow_up_at]);

  const subtitle = zkWatchSubtitle(watch);
  const subiektStatus = zkWatchStatusLabel(watch);
  const closedLabel = formatShortDate(watch.closed_at);
  const clientContact = extractZkWatchClientContact(watch);
  const isRealizedInSubiekt = subiektStatus === "Zrealizowane";
  const followUpDue = !archived && isFollowUpDue(watch.follow_up_at);
  const followUpLabel = formatFollowUpLabel(watch.follow_up_at);
  const mojeClientHref = buildMojeClientLink(watch.sales_person_id, watch.client_label, {
    preview: readOnly || tourPreview,
  });
  const prosbaHref = prosbaHrefFromZkWatch(watch);

  async function markClosed() {
    if (readOnly || tourPreview || closing) return;
    setClosing(true);
    setError(null);
    try {
      await actionCloseZkWatch(watch.id);
      onClosed?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zamknąć sprawy.");
    } finally {
      setClosing(false);
    }
  }

  async function restore() {
    if (readOnly || tourPreview || restoring) return;
    setRestoring(true);
    setError(null);
    try {
      const { watch: restored } = await actionRestoreZkWatch(watch.id);
      onRestored?.(restored);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się przywrócić ZK.");
    } finally {
      setRestoring(false);
    }
  }

  async function refreshFromSubiekt() {
    if (readOnly || tourPreview || refreshing || archived || !subiektReachable) return;
    setRefreshing(true);
    setError(null);
    try {
      const { watch: refreshed } = await actionRefreshZkWatchFromSubiekt(watch.id);
      onRefreshed?.(refreshed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się odświeżyć danych z Subiekta.");
    } finally {
      setRefreshing(false);
    }
  }

  async function saveFollowUp(nextValue?: string) {
    if (readOnly || tourPreview || savingFollowUp || archived) return;
    const value = (nextValue ?? followUpDraft).trim();
    const normalized = value || null;
    if (normalized === (watch.follow_up_at?.slice(0, 10) ?? null)) return;
    setSavingFollowUp(true);
    setError(null);
    try {
      const { watch: updated } = await actionUpdateZkWatchFollowUp(watch.id, normalized);
      setFollowUpDraft(updated.follow_up_at?.slice(0, 10) ?? "");
      onRefreshed?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać przypomnienia.");
    } finally {
      setSavingFollowUp(false);
    }
  }

  async function removeFromArchive() {
    if (readOnly || tourPreview || deleting || !archived) return;
    if (!window.confirm("Usunąć ten ZK z archiwum na stałe? Tej operacji nie można cofnąć.")) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await actionDeleteArchivedZkWatch(watch.id);
      onDeleted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się usunąć wpisu.");
    } finally {
      setDeleting(false);
    }
  }

  async function saveNote() {
    if (readOnly || tourPreview || savingNote || archived) return;
    setSavingNote(true);
    setError(null);
    try {
      await actionUpdateZkWatchNote(watch.id, noteDraft);
      const trimmed = noteDraft.trim();
      setSavedNote(trimmed);
      setNoteOpen(Boolean(trimmed));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać notatki.");
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <Card
      padding={false}
      className={cn(
        archived ? "opacity-80" : undefined,
        followUpDue ? "ring-2 ring-violet-200/90" : undefined
      )}
    >
      <div className={cn("space-y-2", compact ? "p-3" : "space-y-3 p-4 sm:p-5")}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p
                className={cn(
                  "font-semibold tabular-nums text-slate-900",
                  compact ? "text-sm" : "text-base"
                )}
              >
                {watch.zk_number}
              </p>
              {archived ? (
                <Badge variant="default" className="text-[10px]">
                  Zamknięte
                </Badge>
              ) : (
                <>
                  <Badge variant="warning" className="text-[10px]">
                    Czeka na towar
                  </Badge>
                  {followUpDue ? (
                    <Badge variant="purple" className="text-[10px]">
                      Follow-up
                    </Badge>
                  ) : null}
                  {subiektStatus ? (
                    <Badge variant="info" className="text-[10px]">
                      {subiektStatus}
                    </Badge>
                  ) : null}
                </>
              )}
            </div>
            <p className={cn("font-medium text-slate-800", compact ? "text-xs" : "text-sm")}>
              {watch.client_label}
            </p>
            {clientContact.email || clientContact.phone ? (
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {clientContact.phone ? (
                  <a
                    href={normalizePhoneHref(clientContact.phone)}
                    className="font-medium text-indigo-700 hover:text-indigo-900"
                  >
                    {clientContact.phone}
                  </a>
                ) : null}
                {clientContact.email ? (
                  <a
                    href={`mailto:${clientContact.email}`}
                    className="font-medium text-indigo-700 hover:text-indigo-900"
                  >
                    {clientContact.email}
                  </a>
                ) : null}
              </div>
            ) : null}
            {subtitle ? (
              <p className="text-xs leading-relaxed text-slate-500">{subtitle}</p>
            ) : null}
            {watch.amount_gross != null ? (
              <p className="text-xs tabular-nums text-slate-500">{formatPln(watch.amount_gross)}</p>
            ) : null}
            {!archived && followUpLabel ? (
              <p className={cn("text-xs", followUpDue ? "font-semibold text-violet-800" : "text-slate-500")}>
                Przypomnienie {followUpLabel}
              </p>
            ) : null}
            {archived && closedLabel ? (
              <p className="text-xs text-slate-500">Zamknięto {closedLabel}</p>
            ) : null}
          </div>
        </div>

        {isRealizedInSubiekt && !archived && !readOnly ? (
          <div className="flex flex-col gap-2 rounded-md border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-relaxed text-emerald-950">
              W Subiekcie ten ZK ma status „Zrealizowane” — prawdopodobnie towar został już wydany.
            </p>
            <Button size="sm" variant="secondary" disabled={closing} onClick={() => void markClosed()}>
              {closing ? "Zapis…" : "Zamknij sprawę"}
            </Button>
          </div>
        ) : null}

        {!readOnly && !archived ? (
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            <Link href={prosbaHref} onClick={() => stashZkProsbaPrefill(watch)}>
              <Button size="sm" variant="primary" type="button">
                Zgłoś prośbę
              </Button>
            </Link>
            <Button size="sm" variant="secondary" disabled={closing} onClick={() => void markClosed()}>
              {closing ? "Zapis…" : "Zamknij"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={refreshing || !subiektReachable}
              title={!subiektReachable ? "Brak połączenia z systemem magazynowym" : undefined}
              onClick={() => void refreshFromSubiekt()}
            >
              {refreshing ? "Odświeżam…" : "Odśwież z Subiekta"}
            </Button>
            <Link href={mojeClientHref}>
              <Button size="sm" variant="ghost" type="button">
                Prośby klienta
              </Button>
            </Link>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setNoteOpen((v) => !v)}
            >
              {noteOpen ? "Ukryj notatkę" : "Notatka"}
            </Button>
          </div>
        ) : readOnly && !archived ? (
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            <Link href={prosbaHref} onClick={() => stashZkProsbaPrefill(watch)}>
              <Button size="sm" variant="primary" type="button">
                Zgłoś prośbę
              </Button>
            </Link>
            <Link href={mojeClientHref}>
              <Button size="sm" variant="ghost" type="button">
                Prośby klienta
              </Button>
            </Link>
          </div>
        ) : null}

        {!readOnly && !archived ? (
          <div className="space-y-1.5 text-xs text-slate-600">
            <span className="font-medium">⏰ Przypomnij</span>
            <FollowUpQuickDates
              value={followUpDraft || null}
              disabled={savingFollowUp}
              onPick={(iso) => {
                setFollowUpDraft(iso);
                void saveFollowUp(iso);
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <input
                id={`follow-up-${watch.id}`}
                type="date"
                value={followUpDraft}
                disabled={savingFollowUp}
                onChange={(e) => setFollowUpDraft(e.target.value)}
                onBlur={() => void saveFollowUp()}
                className={cn(NOTATNIK_INPUT_CLASS, "h-8 w-auto text-xs")}
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
          </div>
        ) : null}

        {!readOnly && archived ? (
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            <Button size="sm" variant="ghost" disabled={restoring} onClick={() => void restore()}>
              {restoring ? "Przywracam…" : "Przywróć na listę"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={deleting}
              onClick={() => void removeFromArchive()}
              className="text-red-700 hover:text-red-900"
            >
              {deleting ? "Usuwam…" : "Usuń na stałe"}
            </Button>
          </div>
        ) : null}

        {noteOpen && !readOnly && !archived ? (
          <div className="space-y-2">
            <textarea
              rows={2}
              value={noteDraft}
              disabled={savingNote}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Notatka do tego zamówienia…"
              className={cn(NOTATNIK_TEXTAREA_CLASS, "w-full text-xs")}
            />
            <Button size="sm" disabled={savingNote} onClick={() => void saveNote()}>
              {savingNote ? "Zapis…" : "Zapisz notatkę"}
            </Button>
          </div>
        ) : savedNote.trim() && (!noteOpen || readOnly || archived) ? (
          <p className="border-t border-slate-100 pt-3 text-sm text-slate-600">{savedNote}</p>
        ) : null}

        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>
    </Card>
  );
}
