"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  actionRefreshPaymentWatchFromSubiekt,
  actionRestorePaymentWatch,
  actionSettlePaymentWatch,
  actionDeleteArchivedPaymentWatch,
  actionUpdatePaymentWatchFollowUp,
  actionUpdatePaymentWatchNote,
} from "@/app/actions/sales-notepad";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import {
  formatPln,
  formatShortDate,
  paymentWatchStatusLabel,
  paymentWatchSubtitle,
} from "@/lib/sales/notepad-format";
import { isPaymentWatchOverdue } from "@/lib/sales/payment-watch-sort";
import {
  extractPaymentWatchClientContact,
  normalizePhoneHref,
} from "@/lib/sales/payment-watch-contact";
import {
  buildMojeClientLink,
  formatFollowUpLabel,
  isFollowUpDue,
} from "@/lib/sales/notepad-follow-up";
import { controlFocusClass } from "@/lib/ui/ontime-theme";
import type { SalesPaymentWatch } from "@/types/database";

export function PaymentWatchCard({
  watch,
  readOnly,
  onSettled,
  onRestored,
  onRefreshed,
  onDeleted,
  archived,
}: {
  watch: SalesPaymentWatch;
  readOnly?: boolean;
  onSettled?: () => void;
  onRestored?: (watch: SalesPaymentWatch) => void;
  onRefreshed?: (watch: SalesPaymentWatch) => void;
  onDeleted?: () => void;
  archived?: boolean;
}) {
  const [settling, setSettling] = useState(false);
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

  const subtitle = paymentWatchSubtitle(watch);
  const due = formatShortDate(watch.due_at);
  const overdue = !archived && isPaymentWatchOverdue(watch);
  const subiektStatus = paymentWatchStatusLabel(watch);
  const settledLabel = formatShortDate(watch.settled_at);
  const clientContact = extractPaymentWatchClientContact(watch);
  const isRealizedInSubiekt = subiektStatus === "Zrealizowane";
  const followUpDue = !archived && isFollowUpDue(watch.follow_up_at);
  const followUpLabel = formatFollowUpLabel(watch.follow_up_at);
  const mojeClientHref = buildMojeClientLink(watch.sales_person_id, watch.client_label, {
    preview: readOnly,
  });

  async function markPaid() {
    if (readOnly || settling) return;
    setSettling(true);
    setError(null);
    try {
      await actionSettlePaymentWatch(watch.id);
      onSettled?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się oznaczyć jako opłacone.");
    } finally {
      setSettling(false);
    }
  }

  async function restore() {
    if (readOnly || restoring) return;
    setRestoring(true);
    setError(null);
    try {
      const { watch: restored } = await actionRestorePaymentWatch(watch.id);
      onRestored?.(restored);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się przywrócić ZK.");
    } finally {
      setRestoring(false);
    }
  }

  async function refreshFromSubiekt() {
    if (readOnly || refreshing || archived) return;
    setRefreshing(true);
    setError(null);
    try {
      const { watch: refreshed } = await actionRefreshPaymentWatchFromSubiekt(watch.id);
      onRefreshed?.(refreshed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się odświeżyć danych z Subiekta.");
    } finally {
      setRefreshing(false);
    }
  }

  async function saveFollowUp(nextValue?: string) {
    if (readOnly || savingFollowUp || archived) return;
    const value = (nextValue ?? followUpDraft).trim();
    const normalized = value || null;
    if (normalized === (watch.follow_up_at?.slice(0, 10) ?? null)) return;
    setSavingFollowUp(true);
    setError(null);
    try {
      const { watch: updated } = await actionUpdatePaymentWatchFollowUp(watch.id, normalized);
      setFollowUpDraft(updated.follow_up_at?.slice(0, 10) ?? "");
      onRefreshed?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać przypomnienia.");
    } finally {
      setSavingFollowUp(false);
    }
  }

  async function removeFromArchive() {
    if (readOnly || deleting || !archived) return;
    if (!window.confirm("Usunąć ten ZK z archiwum na stałe? Tej operacji nie można cofnąć.")) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await actionDeleteArchivedPaymentWatch(watch.id);
      onDeleted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się usunąć wpisu.");
    } finally {
      setDeleting(false);
    }
  }

  async function saveNote() {
    if (readOnly || savingNote) return;
    setSavingNote(true);
    setError(null);
    try {
      await actionUpdatePaymentWatchNote(watch.id, noteDraft);
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
        overdue ? "ring-2 ring-red-200/90" : followUpDue ? "ring-2 ring-violet-200/90" : undefined
      )}
    >
      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-semibold tabular-nums text-slate-900">
                {watch.zk_number}
              </p>
              {archived ? (
                <Badge variant="default" className="text-[10px]">
                  Opłacone
                </Badge>
              ) : (
                <>
                  <Badge variant="warning" className="text-[10px]">
                    Czeka na zapłatę
                  </Badge>
                  {overdue ? (
                    <Badge variant="danger" className="text-[10px]">
                      Po terminie
                    </Badge>
                  ) : null}
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
            <p className="text-sm font-medium text-slate-800">{watch.client_label}</p>
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
            {!archived && followUpLabel ? (
              <p className={cn("text-xs", followUpDue ? "font-semibold text-violet-800" : "text-slate-500")}>
                Przypomnienie {followUpLabel}
              </p>
            ) : null}
            {archived && settledLabel ? (
              <p className="text-xs text-slate-500">Opłacono {settledLabel}</p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold tabular-nums text-slate-900">
              {formatPln(watch.amount_gross)}
            </p>
            {due ? (
              <p className={cn("text-xs", overdue ? "font-semibold text-red-700" : "text-slate-500")}>
                Termin {due}
              </p>
            ) : null}
          </div>
        </div>

        {isRealizedInSubiekt && !archived && !readOnly ? (
          <div className="flex flex-col gap-2 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-relaxed text-emerald-950">
              W Subiekcie ten ZK ma status „Zrealizowane” — prawdopodobnie już opłacony.
            </p>
            <Button size="sm" variant="secondary" disabled={settling} onClick={() => void markPaid()}>
              {settling ? "Zapis…" : "Oznacz jako opłacone"}
            </Button>
          </div>
        ) : null}

        {!readOnly && !archived ? (
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            <Button size="sm" variant="secondary" disabled={settling} onClick={() => void markPaid()}>
              {settling ? "Zapis…" : "Opłacone"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={refreshing}
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
          <div className="border-t border-slate-100 pt-3">
            <Link href={mojeClientHref}>
              <Button size="sm" variant="ghost" type="button">
                Prośby klienta
              </Button>
            </Link>
          </div>
        ) : null}

        {!readOnly && !archived ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <label htmlFor={`follow-up-${watch.id}`} className="shrink-0 font-medium">
              Przypomnij
            </label>
            <input
              id={`follow-up-${watch.id}`}
              type="date"
              value={followUpDraft}
              disabled={savingFollowUp}
              onChange={(e) => setFollowUpDraft(e.target.value)}
              onBlur={() => void saveFollowUp()}
              className={cn(
                "rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-900",
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
              placeholder="Krótka notatka do tego ZK…"
              className={cn(
                "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900",
                controlFocusClass
              )}
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
