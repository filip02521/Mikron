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
import { IconChevronRight } from "@/components/icons/StrokeIcons";
import { HelpMenuGlyph } from "@/components/ui/UiGlyphs";
import { cn } from "@/lib/cn";
import { brandLinkSubtleClass } from "@/lib/ui/ontime-theme";
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
import type { ZkWatchOrderHints } from "@/lib/sales/zk-watch-order-link";
import type { SalesZkWatch } from "@/types/database";
import { FollowUpQuickDates } from "./FollowUpQuickDates";
import { ZkWatchLinesModal } from "./ZkWatchLinesModal";
import { ZkWatchOverflowMenu } from "./ZkWatchOverflowMenu";
import { buildZkWatchLineViews, formatZkLinesShort } from "@/lib/sales/zk-watch-lines";
import {
  NOTATNIK_INPUT_CLASS,
  NOTATNIK_TEXTAREA_CLASS,
  zkWatchRowClass,
} from "./notatnik-layout";

function ChevronIcon({ open }: { open?: boolean }) {
  return (
    <IconChevronRight
      size={16}
      strokeWidth={2.25}
      className={cn(
        "shrink-0 transition-transform",
        open ? "rotate-90 text-indigo-700" : "text-slate-500"
      )}
      aria-hidden
    />
  );
}

export function ZkWatchCard({
  watch,
  orderHints,
  readOnly,
  tourPreview = false,
  onClosed,
  onRestored,
  onRefreshed,
  onDeleted,
  archived,
  subiektReachable = true,
}: {
  watch: SalesZkWatch;
  orderHints?: ZkWatchOrderHints;
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
  const [expanded, setExpanded] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(watch.note ?? "");
  const [savedNote, setSavedNote] = useState(watch.note ?? "");
  const [savingNote, setSavingNote] = useState(false);
  const [followUpDraft, setFollowUpDraft] = useState(watch.follow_up_at?.slice(0, 10) ?? "");
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linesOpen, setLinesOpen] = useState(false);

  const lineViews = buildZkWatchLineViews(watch);
  const linesShort = formatZkLinesShort(lineViews);

  const subtitle = zkWatchSubtitle(watch, {
    omitLineSummary: lineViews.length > 0,
  });
  const subiektStatus = zkWatchStatusLabel(watch);
  const closedLabel = formatShortDate(watch.closed_at);
  const clientContact = extractZkWatchClientContact(watch);
  const isRealizedInSubiekt = subiektStatus === "Zrealizowane";
  const followUpDue = !archived && isFollowUpDue(watch.follow_up_at);
  const followUpLabel = formatFollowUpLabel(watch.follow_up_at);
  const mojeClientHref = buildMojeClientLink(watch.sales_person_id, watch.client_label, {
    preview: readOnly || tourPreview,
    clientKhId: watch.client_kh_id,
    zkWatchId: watch.id,
    zkNumber: watch.zk_number,
  });
  const hasOpenMatchingProsba = (orderHints?.matchingOpenRequestCount ?? 0) > 0;
  const allLinesFromOrders = orderHints?.allLinesMatchedByOrders ?? false;
  const prosbaHref = prosbaHrefFromZkWatch(watch);
  const canEdit = !readOnly && !tourPreview && !archived;
  const pending = closing || restoring || deleting || refreshing || savingNote || savingFollowUp;

  const metaParts: string[] = [];
  if (subtitle) metaParts.push(subtitle);
  if (watch.amount_gross != null) metaParts.push(formatPln(watch.amount_gross));
  if (!archived && followUpLabel) {
    metaParts.push(followUpDue ? `Przypomnienie: ${followUpLabel}` : `Przyp. ${followUpLabel}`);
  }
  if (archived && closedLabel) metaParts.push(`Zamknięto ${closedLabel}`);

  const hasDetails =
    Boolean(savedNote.trim()) ||
    followUpDue ||
    isRealizedInSubiekt ||
    noteOpen ||
    (!archived && canEdit);

  const needsExpand = hasDetails && !archived;

  useEffect(() => {
    setNoteDraft(watch.note ?? "");
    setSavedNote(watch.note ?? "");
    setFollowUpDraft(watch.follow_up_at?.slice(0, 10) ?? "");
  }, [watch.id, watch.note, watch.follow_up_at]);

  async function markClosed() {
    if (!canEdit || closing) return;
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
    if (!canEdit || refreshing || !subiektReachable) return;
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
    if (!canEdit || savingFollowUp) return;
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
    if (!canEdit || savingNote) return;
    setSavingNote(true);
    setError(null);
    try {
      await actionUpdateZkWatchNote(watch.id, noteDraft);
      const trimmed = noteDraft.trim();
      setSavedNote(trimmed);
      setNoteOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać notatki.");
    } finally {
      setSavingNote(false);
    }
  }

  function openNote() {
    setExpanded(true);
    setNoteOpen(true);
  }

  return (
    <article
      className={zkWatchRowClass({
        followUpDue,
        archived,
        orderDelivered: !archived && allLinesFromOrders,
      })}
    >
      <div className="flex min-h-[2.75rem] items-center gap-1 px-2 py-1.5 sm:gap-1.5 sm:px-3">
        <button
          type="button"
          onClick={() => needsExpand && setExpanded((v) => !v)}
          disabled={!needsExpand}
          aria-expanded={needsExpand ? expanded : undefined}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center",
            needsExpand && "hover:bg-slate-100 hover:text-indigo-700"
          )}
        >
          {needsExpand ? <ChevronIcon open={expanded} /> : null}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
              {watch.zk_number}
            </span>
            <span className="truncate text-sm text-slate-800">{watch.client_label}</span>
          </div>
          {metaParts.length || clientContact.phone || clientContact.email ? (
            <p
              className={cn(
                "mt-0.5 truncate text-[0.68rem] leading-snug",
                followUpDue ? "font-medium text-violet-800" : "text-slate-500"
              )}
            >
              {clientContact.phone ? (
                <>
                  <a
                    href={normalizePhoneHref(clientContact.phone)}
                    className={cn("font-medium", brandLinkSubtleClass)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {clientContact.phone}
                  </a>
                  {metaParts.length > 0 || clientContact.email ? " · " : null}
                </>
              ) : clientContact.email ? (
                <>
                  <a
                    href={`mailto:${clientContact.email}`}
                    className={cn("font-medium", brandLinkSubtleClass)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {clientContact.email}
                  </a>
                  {metaParts.length > 0 ? " · " : null}
                </>
              ) : null}
              {metaParts.join(" · ")}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {hasOpenMatchingProsba && !archived ? (
            <Link
              href={mojeClientHref}
              className="hidden sm:inline-flex"
              title="Prośby tego klienta — Moje zamówienia"
            >
              <Badge variant="info" className="text-[9px] transition-opacity hover:opacity-90">
                Prośba w toku
              </Badge>
            </Link>
          ) : null}
          {allLinesFromOrders && !archived ? (
            <Badge variant="success" className="hidden text-[9px] sm:inline-flex">
              Towar z prośby
            </Badge>
          ) : null}
          {subiektStatus && subiektStatus !== "Aktywne" && !archived ? (
            <Badge variant="info" className="hidden text-[9px] sm:inline-flex">
              {subiektStatus}
            </Badge>
          ) : null}
          {followUpDue ? (
            <Badge variant="purple" className="text-[9px]">
              !
            </Badge>
          ) : null}

          {!archived ? (
            <Link href={prosbaHref} onClick={() => stashZkProsbaPrefill(watch)}>
              <Button
                size="sm"
                variant="primary"
                type="button"
                className="h-7 px-2 text-[0.68rem]"
                disabled={pending}
              >
                Prośba
              </Button>
            </Link>
          ) : null}

          <ZkWatchOverflowMenu
            label={`Opcje — ${watch.zk_number}`}
            disabled={pending}
            archived={archived}
            readOnly={readOnly || tourPreview}
            hasLines={lineViews.length > 0}
            linesLabel={linesShort ?? String(lineViews.length)}
            onOpenLines={() => setLinesOpen(true)}
            onRefresh={canEdit ? () => void refreshFromSubiekt() : undefined}
            refreshDisabled={refreshing || !subiektReachable}
            mojeClientHref={mojeClientHref}
            onNote={canEdit ? openNote : undefined}
            noteLabel={savedNote.trim() ? "Edytuj notatkę" : "Notatka"}
            onClose={canEdit ? () => void markClosed() : undefined}
            closeDisabled={closing}
            onRestore={archived && !readOnly && !tourPreview ? () => void restore() : undefined}
            restoreDisabled={restoring}
            onDelete={
              archived && !readOnly && !tourPreview ? () => void removeFromArchive() : undefined
            }
            deleteDisabled={deleting}
          />
        </div>
      </div>

      {needsExpand && expanded ? (
        <div className="border-t border-slate-100 bg-slate-50/70 px-3 pb-2.5 pt-2 sm:px-3.5">
          {isRealizedInSubiekt && canEdit ? (
            <p className="mb-2 text-[0.68rem] leading-snug text-emerald-900">
              Subiekt: Zrealizowane — rozważ zamknięcie sprawy (menu{" "}
              <HelpMenuGlyph className="align-[-2px]" />
              ).
            </p>
          ) : null}

          {canEdit ? (
            <div className="mb-2 space-y-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[0.65rem] font-medium text-slate-500">Przypomnij</span>
                <FollowUpQuickDates
                  value={followUpDraft || null}
                  disabled={savingFollowUp}
                  className="gap-0.5"
                  onPick={(iso) => {
                    setFollowUpDraft(iso);
                    void saveFollowUp(iso);
                  }}
                />
                <input
                  type="date"
                  value={followUpDraft}
                  disabled={savingFollowUp}
                  onChange={(e) => setFollowUpDraft(e.target.value)}
                  onBlur={() => void saveFollowUp()}
                  className={cn(NOTATNIK_INPUT_CLASS, "h-7 w-auto text-xs")}
                />
                {followUpDraft ? (
                  <button
                    type="button"
                    className="text-[0.68rem] text-slate-500 hover:text-slate-800"
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

          {noteOpen && canEdit ? (
            <div className="space-y-1.5">
              <textarea
                rows={2}
                value={noteDraft}
                disabled={savingNote}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Notatka…"
                className={cn(NOTATNIK_TEXTAREA_CLASS, "w-full text-xs")}
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={savingNote}
                  onClick={() => void saveNote()}
                >
                  {savingNote ? "Zapis…" : "Zapisz"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setNoteDraft(savedNote);
                    setNoteOpen(false);
                  }}
                >
                  Anuluj
                </Button>
              </div>
            </div>
          ) : savedNote.trim() ? (
            <p className="text-xs leading-relaxed text-slate-600">{savedNote}</p>
          ) : null}

          {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
        </div>
      ) : error && !expanded ? (
        <p className="border-t border-slate-100 px-3 py-1.5 text-xs text-red-600">{error}</p>
      ) : null}

      <ZkWatchLinesModal
        watch={watch}
        open={linesOpen}
        readOnly={readOnly}
        tourPreview={tourPreview}
        matchedDeliveredLineKeys={orderHints?.matchedDeliveredLineKeys}
        onClose={() => setLinesOpen(false)}
        onSaved={(updated) => onRefreshed?.(updated)}
      />
    </article>
  );
}
