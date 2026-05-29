"use client";

import { useEffect, useState } from "react";
import {
  actionSettlePaymentWatch,
  actionUpdatePaymentWatchNote,
} from "@/app/actions/sales-notepad";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import {
  formatPln,
  formatShortDate,
  paymentWatchSubtitle,
} from "@/lib/sales/notepad-format";
import { isPaymentWatchOverdue } from "@/lib/sales/payment-watch-sort";
import { controlFocusClass } from "@/lib/ui/ontime-theme";
import type { SalesPaymentWatch } from "@/types/database";

export function PaymentWatchCard({
  watch,
  readOnly,
  onSettled,
  archived,
}: {
  watch: SalesPaymentWatch;
  readOnly?: boolean;
  onSettled?: () => void;
  archived?: boolean;
}) {
  const [settling, setSettling] = useState(false);
  const [noteOpen, setNoteOpen] = useState(Boolean(watch.note?.trim()));
  const [noteDraft, setNoteDraft] = useState(watch.note ?? "");
  const [savedNote, setSavedNote] = useState(watch.note ?? "");
  const [savingNote, setSavingNote] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNoteDraft(watch.note ?? "");
    setSavedNote(watch.note ?? "");
    setNoteOpen(Boolean(watch.note?.trim()));
  }, [watch.id, watch.note]);

  const subtitle = paymentWatchSubtitle(watch);
  const due = formatShortDate(watch.due_at);
  const overdue = !archived && isPaymentWatchOverdue(watch);

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
      className={cn(archived ? "opacity-80" : undefined, overdue ? "ring-2 ring-red-200/90" : undefined)}
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
                </>
              )}
            </div>
            <p className="text-sm font-medium text-slate-800">{watch.client_label}</p>
            {subtitle ? (
              <p className="text-xs leading-relaxed text-slate-500">{subtitle}</p>
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

        {!readOnly && !archived ? (
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            <Button size="sm" variant="secondary" disabled={settling} onClick={() => void markPaid()}>
              {settling ? "Zapis…" : "Opłacone"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setNoteOpen((v) => !v)}
            >
              {noteOpen ? "Ukryj notatkę" : "Notatka"}
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
