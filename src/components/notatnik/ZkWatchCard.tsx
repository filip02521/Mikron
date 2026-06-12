"use client";

import Link from "next/link";
import { useState, type KeyboardEvent, type MouseEvent } from "react";
import {
  actionRefreshZkWatchFromSubiekt,
  actionRestoreZkWatch,
  actionCloseZkWatch,
  actionDeleteArchivedZkWatch,
} from "@/app/actions/sales-notepad";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatZkWatchDisplayNumber } from "@/lib/sales/notepad-format";
import { isFollowUpDue, buildMojeClientLink } from "@/lib/sales/notepad-follow-up";
import {
  prosbaHrefFromZkWatch,
  stashZkProsbaPrefill,
} from "@/lib/orders/zk-watch-prosba-prefill";
import { appendMojeFocusOrderIds } from "@/lib/orders/moje-order-focus";
import type { ZkWatchOrderHints } from "@/lib/sales/zk-watch-order-link";
import type { SalesZkWatch } from "@/types/database";
import {
  mojeQueueRowActionsClass,
  mojeQueueRowLayoutClass,
  mojeQueueRowMainClass,
  mojeShipmentRowClass,
} from "@/lib/ui/moje-shipment-row-styles";
import { salesTypography } from "@/lib/ui/ontime-theme";
import { formatZkWatchNotePreview } from "@/lib/sales/zk-watch-row-display";
import { ZkWatchFollowUpButton } from "./ZkWatchFollowUpButton";
import { ZkWatchLinesModal } from "./ZkWatchLinesModal";
import { ZkWatchOverflowMenu } from "./ZkWatchOverflowMenu";
import { buildZkWatchLineViews, formatZkLinesPreview, formatZkLinesShort, allZkWatchLinesArrived } from "@/lib/sales/zk-watch-lines";

export function ZkWatchCard({
  watch,
  anchorId,
  orderHints,
  readOnly,
  tourPreview = false,
  onClosed,
  onRestored,
  onRefreshed,
  onDeleted,
  archived,
  subiektReachable = true,
  compact = true,
  onLinesModalOpenChange,
  hasNewWarehouseArrival = false,
  onWatchSeen,
}: {
  watch: SalesZkWatch;
  /** Kotwica #watch-… — na karcie, nie na liście (unika obcinania obwódki). */
  anchorId?: string;
  orderHints?: ZkWatchOrderHints;
  readOnly?: boolean;
  tourPreview?: boolean;
  onClosed?: (closedAt: string) => void;
  onRestored?: (watch: SalesZkWatch) => void;
  onRefreshed?: (watch: SalesZkWatch) => void;
  onDeleted?: () => void;
  archived?: boolean;
  compact?: boolean;
  subiektReachable?: boolean;
  onLinesModalOpenChange?: (open: boolean) => void;
  hasNewWarehouseArrival?: boolean;
  onWatchSeen?: (watchId: string) => void;
}) {
  const [closing, setClosing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [linesOpen, setLinesOpen] = useState(false);
  const [focusNoteOnOpen, setFocusNoteOnOpen] = useState(false);
  const [error, setError] = useState<{ watchId: string; message: string } | null>(null);
  const displayError = error?.watchId === watch.id ? error.message : null;

  const lineViews = buildZkWatchLineViews(watch);
  const linesShort = formatZkLinesShort(lineViews);
  const linesPreview = formatZkLinesPreview(lineViews);
  const hasLines = lineViews.length > 0 || Boolean(watch.line_summary?.trim());

  const followUpDue = !archived && isFollowUpDue(watch.follow_up_at);
  const notePreview = formatZkWatchNotePreview(watch.note);
  const mojeClientHref = buildMojeClientLink(watch.sales_person_id, watch.client_label, {
    preview: readOnly || tourPreview,
    clientKhId: watch.client_kh_id,
    zkWatchId: watch.id,
    zkNumber: watch.zk_number,
  });
  const hasOpenMatchingProsba = (orderHints?.matchingOpenRequestCount ?? 0) > 0;
  const prosbaInTokuHref = appendMojeFocusOrderIds(
    mojeClientHref,
    orderHints?.matchingOpenRequestIds ?? []
  );
  const allLinesArrived = allZkWatchLinesArrived(lineViews);
  const allLinesMatchedByOrders = orderHints?.allLinesMatchedByOrders ?? false;
  const readyToClose = !archived && (allLinesArrived || allLinesMatchedByOrders);
  const prosbaHref = prosbaHrefFromZkWatch(watch);
  const canEdit = !readOnly && !tourPreview && !archived;
  const pending = closing || restoring || deleting || refreshing;

  const displayNumber = formatZkWatchDisplayNumber(watch.zk_number);
  const productPreview =
    linesPreview ??
    (watch.line_summary?.trim()
      ? watch.line_summary.trim().length > 52
        ? `${watch.line_summary.trim().slice(0, 51)}…`
        : watch.line_summary.trim()
      : null);

  function openLinesModal(focusNote = false) {
    setFocusNoteOnOpen(focusNote);
    setLinesOpen(true);
    onLinesModalOpenChange?.(true);
  }

  function closeLinesModal() {
    setLinesOpen(false);
    setFocusNoteOnOpen(false);
    onLinesModalOpenChange?.(false);
    if (hasNewWarehouseArrival) {
      onWatchSeen?.(watch.id);
    }
  }

  const rowAriaLabel = [
    `${displayNumber} ${watch.client_label}`,
    readyToClose ? "gotowe do zamknięcia" : null,
    followUpDue ? "przypomnienie do działania" : null,
    "pokaż szczegóły ZK",
  ]
    .filter(Boolean)
    .join(" — ");

  function handleRowClick(event: MouseEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("[data-zk-row-action]")) return;
    openLinesModal(false);
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    if ((event.target as HTMLElement).closest("[data-zk-row-action]")) return;
    event.preventDefault();
    openLinesModal(false);
  }

  function handleNoteClick(event: MouseEvent<HTMLElement>) {
    event.stopPropagation();
    openLinesModal(true);
  }

  async function markClosed() {
    if (!canEdit || closing) return;
    setClosing(true);
    setError(null);
    try {
      const { closedAt } = await actionCloseZkWatch(watch.id);
      onClosed?.(closedAt);
    } catch (e) {
      setError({
        watchId: watch.id,
        message: e instanceof Error ? e.message : "Nie udało się zamknąć sprawy.",
      });
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
      setError({
        watchId: watch.id,
        message: e instanceof Error ? e.message : "Nie udało się przywrócić ZK.",
      });
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
      setError({
        watchId: watch.id,
        message: e instanceof Error ? e.message : "Nie udało się odświeżyć danych z Subiekta.",
      });
    } finally {
      setRefreshing(false);
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
      setError({
        watchId: watch.id,
        message: e instanceof Error ? e.message : "Nie udało się usunąć wpisu.",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article
      id={anchorId}
      className={cn(
        anchorId && "scroll-mt-3 scroll-mb-3",
        mojeShipmentRowClass({
          expanded: false,
          isAction: readyToClose,
          isUrgent: followUpDue,
          isInformacja: false,
          visualTone: archived ? "archive" : "default",
        }),
        followUpDue && readyToClose && "ring-1 ring-inset ring-amber-300/50",
        hasNewWarehouseArrival && "ring-1 ring-inset ring-emerald-300/70"
      )}
    >
      <div
        className={cn(
          mojeQueueRowLayoutClass,
          compact ? "px-2 py-1.5 sm:px-3" : "px-3 py-2"
        )}
      >
        <div
          className={cn(mojeQueueRowMainClass, "min-w-0 flex-1 cursor-pointer")}
          role="button"
          tabIndex={0}
          onClick={handleRowClick}
          onKeyDown={handleRowKeyDown}
          aria-label={rowAriaLabel}
        >
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-baseline gap-x-1.5">
              <span
                className={cn(
                  "shrink-0 font-semibold tabular-nums text-slate-900",
                  compact ? "text-xs" : salesTypography.rowTitle
                )}
              >
                {displayNumber}
              </span>
              <span
                className={cn(
                  "min-w-0 truncate font-medium text-slate-800",
                  compact ? "text-xs" : salesTypography.rowTitle
                )}
              >
                {watch.client_label}
              </span>
              {hasNewWarehouseArrival ? (
                <Badge variant="success" className="shrink-0 text-[9px]">
                  Na magazynie
                </Badge>
              ) : null}
            </div>

            {productPreview ? (
              <p className={cn("mt-0.5 truncate", salesTypography.rowMeta, "text-slate-600")}>
                {productPreview}
              </p>
            ) : null}

            {notePreview ? (
              <button
                type="button"
                data-zk-row-action=""
                onClick={handleNoteClick}
                className={cn(
                  "mt-0.5 block max-w-full truncate text-left font-medium",
                  salesTypography.rowMeta,
                  "rounded-sm text-indigo-900/90 transition hover:bg-indigo-50/80"
                )}
                title={notePreview}
              >
                {notePreview}
              </button>
            ) : null}
          </div>
        </div>

        <div className={mojeQueueRowActionsClass} data-zk-row-action="">
          <div className="flex items-center justify-end gap-1">
            {hasOpenMatchingProsba && !archived ? (
              <Link
                href={prosbaInTokuHref}
                className={cn(
                  "hidden sm:inline-flex",
                  salesTypography.rowMeta,
                  "font-medium text-indigo-700 hover:underline"
                )}
                title="Przejdź do powiązanych prośb"
              >
                Prośba w toku
              </Link>
            ) : null}

            {!archived ? (
              <Link href={prosbaHref} onClick={() => stashZkProsbaPrefill(watch)}>
                <Button
                  size="sm"
                  variant="primary"
                  type="button"
                  className="h-8 px-2.5 text-[0.68rem] sm:h-7"
                  disabled={pending}
                >
                  Prośba
                </Button>
              </Link>
            ) : null}

            {!archived ? (
              <ZkWatchFollowUpButton
                watch={watch}
                readOnly={readOnly}
                tourPreview={tourPreview}
                archived={archived}
                disabled={pending}
                onSaved={onRefreshed}
              />
            ) : null}

            <ZkWatchOverflowMenu
              label={`Opcje — ${watch.zk_number}`}
              disabled={pending}
              archived={archived}
              readOnly={readOnly || tourPreview}
              hasLines={hasLines}
              linesLabel={linesShort ?? String(lineViews.length || 1)}
              onOpenLines={() => openLinesModal(false)}
              onRefresh={canEdit ? () => void refreshFromSubiekt() : undefined}
              refreshDisabled={refreshing || !subiektReachable}
              mojeClientHref={mojeClientHref}
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
      </div>

      {hasOpenMatchingProsba && !archived ? (
        <div className="border-t border-slate-100/80 px-3 pb-1.5 pt-0 sm:hidden">
          <Link href={prosbaInTokuHref}>
            <Badge variant="info" className="text-[9px]">
              Prośba w toku
            </Badge>
          </Link>
        </div>
      ) : null}

      {displayError ? (
        <p className="border-t border-slate-100 px-3 py-1.5 text-xs text-red-600">{displayError}</p>
      ) : null}

      <ZkWatchLinesModal
        watch={watch}
        open={linesOpen}
        readOnly={readOnly}
        tourPreview={tourPreview}
        archived={archived}
        focusNote={focusNoteOnOpen}
        matchedDeliveredLineKeys={orderHints?.matchedDeliveredLineKeys}
        onClose={closeLinesModal}
        onSaved={(updated) => onRefreshed?.(updated)}
      />
    </article>
  );
}
