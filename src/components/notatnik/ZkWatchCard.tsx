"use client";

import { useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import { actionRefreshZkWatchFromSubiekt, actionRestoreZkWatch, actionDeleteArchivedZkWatch } from "@/app/actions/sales-notepad";
import { Badge } from "@/components/ui/Badge";
import { ActionLoadingOverlay } from "@/components/ui/ActionLoadingOverlay";
import { cn } from "@/lib/cn";
import { formatZkWatchDisplayNumber } from "@/lib/sales/notepad-format";
import { isFollowUpDue, buildMojeClientLink } from "@/lib/sales/notepad-follow-up";
import {
  prosbaHrefFromZkWatch,
  stashZkProsbaPrefill,
  type ZkProsbaPrefillOptions,
} from "@/lib/orders/zk-watch-prosba-prefill";
import { appendMojeFocusOrderIds } from "@/lib/orders/moje-order-focus";
import type { ZkWatchOrderHints } from "@/lib/sales/zk-watch-order-link";
import { collectPartialLineKeysFromCoverage } from "@/lib/sales/zk-watch-order-link";
import {
  allZkWatchLinesCheckboxChecked,
  applyZkProsbaStockFilterToCardAction,
  deriveZkWatchProsbaCardAction,
  buildZkWatchLineStatusSummary,
  formatZkProsbaCardActionLabelAfterStockFilter,
  formatZkWatchLineCheckboxPreview,
  formatZkWatchLineCheckboxShort,
  resolveZkWatchProsbaCardLineKeys,
  resolveZkWatchProsbaPrefillLineKeys,
} from "@/lib/sales/zk-watch-line-ui-state";
import type { ZkWatchRefreshDiff } from "@/lib/sales/zk-watch-refresh-diff";
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
import { ZkWatchOverflowMenu } from "./ZkWatchOverflowMenu";
import { ZkWatchProsbaActions } from "./ZkWatchProsbaActions";
import { buildZkWatchLineViews } from "@/lib/sales/zk-watch-lines";
import {
  countZkWatchLinesOutsideTrackedScope,
  filterZkWatchProductLineViewsForScope,
  formatZkWatchProsbaScopeSummary,
  hasZkWatchTrackedProsbaScope,
} from "@/lib/sales/zk-watch-prosba-scope";
import { zkWatchLineViewToProsbaScopeLine } from "@/lib/orders/prosba-stock-check";
import { useZkProsbaLineKeysStockFilter } from "@/hooks/useZkProsbaLineKeysStockFilter";

export function ZkWatchCard({
  watch,
  anchorId,
  orderHints,
  readOnly,
  tourPreview = false,
  onRestored,
  onRefreshed,
  onDeleted,
  archived,
  subiektReachable = true,
  compact = true,
  onLinesModalOpenChange,
  hasNewWarehouseArrival = false,
  hasNewZkLines = false,
  isNewlyAdded = false,
  newLineKeys,
  onProsbaScopeRequested,
  onRequestCloseWatch,
  closePreviewLoading = false,
  closeFlowError,
}: {
  watch: SalesZkWatch;
  /** Kotwica #watch-… — na karcie, nie na liście (unika obcinania obwódki). */
  anchorId?: string;
  orderHints?: ZkWatchOrderHints;
  readOnly?: boolean;
  tourPreview?: boolean;
  onRestored?: (watch: SalesZkWatch) => void;
  onRefreshed?: (
    watch: SalesZkWatch,
    refreshDiff?: ZkWatchRefreshDiff,
    options?: { skipRouterRefresh?: boolean }
  ) => void;
  onDeleted?: () => void;
  archived?: boolean;
  compact?: boolean;
  subiektReachable?: boolean;
  onLinesModalOpenChange?: (open: boolean, options?: { focusNote?: boolean }) => void;
  hasNewWarehouseArrival?: boolean;
  hasNewZkLines?: boolean;
  isNewlyAdded?: boolean;
  newLineKeys?: string[];
  /** Ponowne otwarcie modala zakresu prośby (gdy jeszcze nie skonfigurowano). */
  onProsbaScopeRequested?: (watchId: string) => void;
  onRequestCloseWatch?: (watch: SalesZkWatch) => void;
  closePreviewLoading?: boolean;
  closeFlowError?: string;
}) {
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [prosbaStockArmed, setProsbaStockArmed] = useState(false);
  const [error, setError] = useState<{ watchId: string; message: string } | null>(null);
  const displayError =
    closeFlowError ??
    (error?.watchId === watch.id ? error.message : null);

  const lineViews = useMemo(() => buildZkWatchLineViews(watch), [watch]);
  const scopedLineViews = useMemo(
    () => filterZkWatchProductLineViewsForScope(lineViews, watch, { showAllLines: false }),
    [lineViews, watch]
  );
  const hasTrackedScope = useMemo(() => hasZkWatchTrackedProsbaScope(watch), [watch]);
  const hiddenOutsideScope = useMemo(
    () => countZkWatchLinesOutsideTrackedScope(watch, lineViews),
    [watch, lineViews]
  );
  const checkboxContext = useMemo(
    () => ({
      newLineKeys: newLineKeys ?? [],
      inStockLineKeys: orderHints?.inStockLineKeys ?? [],
      informacjaReadyLineKeys: orderHints?.informacjaReadyLineKeys ?? [],
      informacjaAcknowledgedLineKeys: orderHints?.informacjaAcknowledgedLineKeys ?? [],
      scopeExcludedLineKeys: orderHints?.scopeExcludedLineKeys ?? [],
      lineCoverageByKey: orderHints?.lineCoverageByKey,
    }),
    [newLineKeys, orderHints]
  );
  const linesShort = formatZkWatchLineCheckboxShort({
    lineViews: scopedLineViews,
    ...checkboxContext,
  });
  const linesPreview = formatZkWatchLineCheckboxPreview({
    lineViews: scopedLineViews,
    ...checkboxContext,
  });
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
  const allLinesChecked = allZkWatchLinesCheckboxChecked({
    lineViews: scopedLineViews,
    ...checkboxContext,
  });
  const readyToClose = !archived && allLinesChecked;
  const hasInformacjaReady = (orderHints?.informacjaReadyLineKeys?.length ?? 0) > 0;
  const hasPhysicalDeliverySignal =
    (orderHints?.matchedDeliveredLineKeys?.length ?? 0) > 0 ||
    (orderHints?.inStockLineKeys?.length ?? 0) > 0 ||
    (orderHints?.regalWaitingLineKeys?.length ?? 0) > 0;
  const isInformacjaReadyAccent =
    hasInformacjaReady &&
    !readyToClose &&
    !followUpDue &&
    !hasNewWarehouseArrival &&
    !hasPhysicalDeliverySignal;
  const isNewlyAddedAccent =
    isNewlyAdded &&
    !archived &&
    !hasNewWarehouseArrival &&
    !hasNewZkLines &&
    !isInformacjaReadyAccent;
  const uncoveredLineKeys = useMemo(
    () => orderHints?.uncoveredLineKeys ?? [],
    [orderHints?.uncoveredLineKeys]
  );
  const openProsbaLineKeys = orderHints?.openProsbaCoveredLineKeys ?? [];
  const productLineCount = lineViews.filter((line) => line.key !== "summary").length;
  const prosbaScopeConfigured = orderHints?.prosbaScopeConfigured ?? false;
  const prosbaCardAction = deriveZkWatchProsbaCardAction({
    lineCount: productLineCount,
    uncoveredLineKeys,
    openProsbaLineKeys,
    partialLineKeys: collectPartialLineKeysFromCoverage(orderHints?.lineCoverageByKey),
    regalWaitingLineKeys: orderHints?.regalWaitingLineKeys ?? [],
    informacjaReadyLineKeys: orderHints?.informacjaReadyLineKeys ?? [],
    scopeExcludedLineKeys: orderHints?.scopeExcludedLineKeys ?? [],
    newLineKeys: newLineKeys ?? [],
    hasOpenMatchingProsba,
  });

  const prosbaScopeLines = useMemo(
    () =>
      lineViews
        .filter((line) => line.key !== "summary")
        .map((line) => zkWatchLineViewToProsbaScopeLine(line)),
    [lineViews]
  );
  const prosbaActionLineKeys = useMemo(() => {
    if (prosbaCardAction.kind !== "new_prosba" && prosbaCardAction.kind !== "supplement") {
      return [] as string[];
    }
    return resolveZkWatchProsbaCardLineKeys({
      action: prosbaCardAction,
      uncoveredLineKeys,
    });
  }, [prosbaCardAction, uncoveredLineKeys]);
  const prosbaStockFilterEnabled =
    prosbaStockArmed &&
    !archived &&
    !readOnly &&
    !tourPreview &&
    uncoveredLineKeys.length > 0 &&
    (prosbaCardAction.kind === "new_prosba" || prosbaCardAction.kind === "supplement");
  const {
    stockLoading: prosbaStockLoading,
    allOnStock: prosbaAllOnStock,
    lineKeysToOrder: prosbaStockFilteredKeys,
    stockByTwId: prosbaStockByTwId,
  } = useZkProsbaLineKeysStockFilter(
    prosbaScopeLines,
    uncoveredLineKeys,
    prosbaStockFilterEnabled,
    prosbaScopeConfigured ? { orderMarkedKeys: prosbaActionLineKeys } : undefined
  );
  const displayProsbaCardAction = useMemo(
    () =>
      applyZkProsbaStockFilterToCardAction({
        action: prosbaCardAction,
        stockLoading: prosbaStockLoading,
        allOnStock: prosbaAllOnStock,
        hasOpenMatchingProsba,
        explicitScopeSelection: prosbaScopeConfigured,
      }),
    [
      prosbaCardAction,
      prosbaStockLoading,
      prosbaAllOnStock,
      hasOpenMatchingProsba,
      prosbaScopeConfigured,
    ]
  );
  const prosbaButtonLabel = useMemo(() => {
    if (displayProsbaCardAction.kind === "view_open") {
      return displayProsbaCardAction.label;
    }
    if (
      displayProsbaCardAction.kind === "covered" ||
      displayProsbaCardAction.kind === "none"
    ) {
      return undefined;
    }
    const sourceCount = prosbaActionLineKeys.length;
    const filteredCount =
      prosbaScopeConfigured || !prosbaStockFilterEnabled
        ? sourceCount
        : prosbaStockFilteredKeys.length;
    return formatZkProsbaCardActionLabelAfterStockFilter({
      action: displayProsbaCardAction,
      stockLoading: prosbaStockLoading,
      allOnStock: prosbaAllOnStock,
      filteredCount,
      sourceCount,
      hasOpenMatchingProsba,
      explicitScopeSelection: prosbaScopeConfigured,
    });
  }, [
    displayProsbaCardAction,
    prosbaActionLineKeys.length,
    prosbaScopeConfigured,
    prosbaStockFilterEnabled,
    prosbaStockFilteredKeys.length,
    prosbaStockLoading,
    prosbaAllOnStock,
    hasOpenMatchingProsba,
  ]);

  const prosbaPrefillOptions: ZkProsbaPrefillOptions | undefined = useMemo(() => {
    const lineKeys = resolveZkWatchProsbaPrefillLineKeys({
      action: prosbaCardAction,
      uncoveredLineKeys,
      prosbaScopeConfigured,
      stockFilteredKeys: prosbaStockFilteredKeys,
      applyStockFilter: prosbaStockFilterEnabled,
    });
    if (prosbaCardAction.kind === "supplement") {
      return lineKeys?.length
        ? { lineKeys, mode: "supplement" }
        : undefined;
    }
    if (prosbaCardAction.kind === "new_prosba") {
      return lineKeys?.length ? { lineKeys } : undefined;
    }
    return undefined;
  }, [
    prosbaCardAction,
    uncoveredLineKeys,
    prosbaScopeConfigured,
    prosbaStockFilteredKeys,
    prosbaStockFilterEnabled,
  ]);

  const prosbaHref = prosbaHrefFromZkWatch(watch, prosbaPrefillOptions);

  const prosbaScopeSummary = prosbaScopeConfigured
    ? formatZkWatchProsbaScopeSummary(watch, lineViews)
    : null;

  const lineStatusSummary = orderHints
    ? buildZkWatchLineStatusSummary({
        lineViews: scopedLineViews,
        newLineKeys: newLineKeys ?? [],
        inStockLineKeys: orderHints.inStockLineKeys,
        informacjaReadyLineKeys: orderHints.informacjaReadyLineKeys,
        informacjaAcknowledgedLineKeys: orderHints.informacjaAcknowledgedLineKeys,
        scopeExcludedLineKeys: orderHints.scopeExcludedLineKeys,
        lineCoverageByKey: orderHints.lineCoverageByKey,
      })
    : null;
  const cardMetaSummary = [prosbaScopeSummary, lineStatusSummary].filter(Boolean).join(" · ") || null;

  const prosbaActionCount = uncoveredLineKeys.length;

  function handleProsbaClick(event: MouseEvent<HTMLAnchorElement>) {
    const ok = stashZkProsbaPrefill(watch, {
      ...prosbaPrefillOptions,
      stockByTwId: prosbaStockByTwId,
    });
    if (!ok) {
      event.preventDefault();
      setError({
        watchId: watch.id,
        message: "Brak pozycji do dodania do prośby — odśwież ZK z Subiekta.",
      });
    }
  }
  const canEdit = !readOnly && !tourPreview && !archived;
  const pending =
    restoring ||
    deleting ||
    refreshing ||
    closePreviewLoading;

  const displayNumber = formatZkWatchDisplayNumber(watch.zk_number);
  const productPreview =
    linesPreview ??
    (watch.line_summary?.trim()
      ? watch.line_summary.trim().length > 52
        ? `${watch.line_summary.trim().slice(0, 51)}…`
        : watch.line_summary.trim()
      : null);
  const linesMenuLabel =
    linesShort ??
    String(scopedLineViews.filter((line) => line.key !== "summary").length || lineViews.length || 1);

  function openLinesModal(focusNote = false) {
    onLinesModalOpenChange?.(true, { focusNote });
  }

  const rowAriaLabel = [
    `${displayNumber} ${watch.client_label}`,
    readyToClose ? "gotowe do zamknięcia" : null,
    followUpDue ? "przypomnienie do działania" : null,
    isNewlyAdded ? "nowo dodane ZK" : null,
    hasNewZkLines ? "nowe pozycje w ZK" : null,
    hasTrackedScope && hiddenOutsideScope > 0
      ? `${hiddenOutsideScope} pozycji spoza wybranego zakresu`
      : null,
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
      const { watch: refreshed, refreshDiff } = await actionRefreshZkWatchFromSubiekt(watch.id);
      onRefreshed?.(refreshed, refreshDiff);
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
          deliveryBorderAccent: isNewlyAddedAccent
            ? "border-l-violet-500"
            : isInformacjaReadyAccent
              ? "border-l-sky-500"
              : undefined,
          deliveryCollapsedBg: isNewlyAddedAccent
            ? "bg-violet-50/30"
            : isInformacjaReadyAccent
              ? "bg-sky-50/35"
              : undefined,
          visualTone: archived ? "archive" : "default",
        }),
        followUpDue && readyToClose && "ring-1 ring-inset ring-amber-300/50",
        hasInformacjaReady &&
          !hasNewWarehouseArrival &&
          isInformacjaReadyAccent &&
          "ring-1 ring-inset ring-sky-300/70",
        hasNewWarehouseArrival && "ring-1 ring-inset ring-teal-300/80",
        hasNewZkLines && !hasNewWarehouseArrival && "ring-1 ring-inset ring-amber-300/70",
        isNewlyAddedAccent && "ring-1 ring-inset ring-violet-300/70",
        closePreviewLoading && "relative"
      )}
    >
      {closePreviewLoading ? (
        <ActionLoadingOverlay message="Sprawdzam pozycje…" variant="section" />
      ) : null}
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
                  Na regale
                </Badge>
              ) : null}
              {isNewlyAdded && !archived ? (
                <Badge variant="purple" className="shrink-0 text-[9px]">
                  Nowe
                </Badge>
              ) : null}
              {hasNewZkLines ? (
                <Badge variant="warning" className="shrink-0 text-[9px]">
                  Nowe pozycje
                </Badge>
              ) : null}
              {hasTrackedScope && hiddenOutsideScope > 0 ? (
                <span
                  className="shrink-0"
                  title={`${hiddenOutsideScope} poz. spoza wybranego zakresu — pełną listę zobaczysz w podglądzie ZK`}
                >
                  <Badge variant="default" className="text-[9px] text-slate-600">
                    +{hiddenOutsideScope} poz. ZK
                  </Badge>
                </span>
              ) : null}
            </div>

            {productPreview ? (
              <p
                className={cn("mt-0.5 truncate", salesTypography.rowMeta, "text-slate-600")}
                title={
                  hasTrackedScope && hiddenOutsideScope > 0
                    ? `${productPreview} — w podglądzie widać wybrane pozycje; +${hiddenOutsideScope} poz. spoza zakresu`
                    : productPreview
                }
              >
                {productPreview}
              </p>
            ) : null}

            {cardMetaSummary ? (
              <p
                className={cn("mt-0.5 truncate", salesTypography.rowMeta, "text-slate-500")}
                title={cardMetaSummary}
              >
                {cardMetaSummary}
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
            ) : canEdit ? (
              <button
                type="button"
                data-zk-row-action=""
                onClick={handleNoteClick}
                className={cn(
                  "mt-0.5 block max-w-full truncate text-left",
                  salesTypography.rowMeta,
                  "rounded-sm text-indigo-700/90 transition hover:bg-indigo-50/80 hover:text-indigo-900"
                )}
              >
                Dodaj notatkę…
              </button>
            ) : null}
          </div>
        </div>

        <div className={mojeQueueRowActionsClass} data-zk-row-action="">
          <div
            className="flex items-center justify-end gap-1"
            onMouseEnter={() => setProsbaStockArmed(true)}
            onFocusCapture={() => setProsbaStockArmed(true)}
          >
            <ZkWatchProsbaActions
              archived={archived}
              pending={pending}
              prosbaCardAction={displayProsbaCardAction}
              prosbaHref={prosbaHref}
              prosbaInTokuHref={prosbaInTokuHref}
              onProsbaClick={handleProsbaClick}
              uncoveredCount={prosbaActionCount}
              buttonLabel={prosbaButtonLabel}
            />

            {!archived ? (
              <ZkWatchFollowUpButton
                watch={watch}
                readOnly={readOnly}
                tourPreview={tourPreview}
                archived={archived}
                disabled={pending}
                onSaved={(updated) =>
                  onRefreshed?.(updated, undefined, { skipRouterRefresh: true })
                }
              />
            ) : null}

            <ZkWatchOverflowMenu
              label={`Opcje — ${watch.zk_number}`}
              disabled={pending}
              archived={archived}
              readOnly={readOnly || tourPreview}
              hasLines={hasLines}
              linesLabel={linesMenuLabel}
              onOpenLines={() => openLinesModal(false)}
              onEditProsbaScope={
                canEdit && productLineCount > 0
                  ? () => onProsbaScopeRequested?.(watch.id)
                  : undefined
              }
              onRefresh={canEdit ? () => void refreshFromSubiekt() : undefined}
              refreshDisabled={refreshing || !subiektReachable}
              mojeClientHref={mojeClientHref}
              onClose={canEdit && onRequestCloseWatch ? () => onRequestCloseWatch(watch) : undefined}
              closeDisabled={closePreviewLoading}
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

      {displayError ? (
        <p className="border-t border-slate-100 px-3 py-1.5 text-xs text-red-600">{displayError}</p>
      ) : null}

    </article>
  );
}
