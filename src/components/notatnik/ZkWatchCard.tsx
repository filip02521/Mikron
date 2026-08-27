"use client";

import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import { useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import { actionRefreshZkWatchFromSubiekt, actionRestoreZkWatch, actionDeleteArchivedZkWatch } from "@/app/actions/sales-notepad";
import { ActionLoadingOverlay, actionLoadingVirtualItemScopeClass } from "@/components/ui/ActionLoadingOverlay";
import { cn } from "@/lib/cn";
import { formatZkWatchDisplayNumber } from "@/lib/sales/notepad-format";
import { isFollowUpDue, buildMojeClientLink, formatFollowUpLabel } from "@/lib/sales/notepad-follow-up";
import {
  prosbaHrefFromZkWatch,
  stashZkProsbaPrefill,
  type ZkProsbaPrefillOptions,
} from "@/lib/orders/zk-watch-prosba-prefill";
import { zkWatchTeethDraftsReady } from "@/lib/sales/zk-watch-teeth-draft";
import { appendMojeFocusOrderIds } from "@/lib/orders/moje-order-focus";
import type { ZkLinkableOrder, ZkWatchOrderHints } from "@/lib/sales/zk-watch-order-link";
import { collectPartialLineKeysFromCoverage } from "@/lib/sales/zk-watch-order-link";
import {
  deriveZkCaseNotePendingAttachKind,
  deriveZkCaseNoteProsbaStatus,
  openZkLinkedOrdersWithCaseNoteState,
  zkCaseNoteProsbaStatusCopy,
} from "@/lib/sales/zk-watch-case-note-prosba";
import {
  allZkWatchLinesCheckboxChecked,
  applyZkProsbaStockFilterToCardAction,
  deriveZkWatchProsbaCardAction,
  buildZkWatchLineStatusSummary,
  formatZkProsbaCardActionLabelAfterStockFilter,
  formatZkWatchLineCheckboxPreview,
  formatZkWatchLineCheckboxShort,
  formatZkWatchProsbaRowMeta,
  resolveZkWatchProsbaCardLineKeys,
  resolveZkWatchProsbaPrefillLineKeys,
} from "@/lib/sales/zk-watch-line-ui-state";
import type { ZkWatchRefreshDiff } from "@/lib/sales/zk-watch-refresh-diff";
import type { SalesZkWatch } from "@/types/database";
import {
  mojeQueueRowActionsClass,
  mojeQueueRowLayoutClass,
  mojeQueueRowMainClass,
} from "@/lib/ui/moje-shipment-row-styles";
import { salesTypography } from "@/lib/ui/ontime-theme";
import {
  buildZkWatchCardMetaSummary,
  deriveZkWatchFollowUpDueBadge,
  deriveZkWatchRowAttention,
  deriveZkWatchRowChrome,
  deriveZkWatchRowSecondaryMeta,
} from "@/lib/sales/zk-watch-row-attention";
import {
  zkWatchRowActionsMobileDividerClass,
  zkWatchRowShellClassForChrome,
} from "@/lib/ui/zk-watch-attention-styles";
import { zkWatchRowActionBarClass } from "@/lib/ui/zk-watch-row-action-styles";
import { formatZkWatchNotePreview } from "@/lib/sales/zk-watch-row-display";
import { ZkCaseNoteProsbaChip } from "./ZkCaseNoteProsbaChip";
import { ZkWatchAttentionBadge } from "./ZkWatchAttentionBadge";
import { ZkWatchFollowUpButton } from "./ZkWatchFollowUpButton";
import { ZkWatchRowAccentRail, ZkWatchRowAttentionRail } from "./ZkWatchRowAttentionRail";
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
  linkableOrders = [],
  readOnly,
  delegatePreview = false,
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
  onTeethDraftRequested,
  teethRegistry,
  onRequestCloseWatch,
  closePreviewLoading = false,
  autoProsbaPending = false,
  closeFlowError,
}: {
  watch: SalesZkWatch;
  /** Kotwica #watch-… — na karcie, nie na liście (unika obcinania obwódki). */
  anchorId?: string;
  orderHints?: ZkWatchOrderHints;
  linkableOrders?: ZkLinkableOrder[];
  readOnly?: boolean;
  delegatePreview?: boolean;
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
  onTeethDraftRequested?: (watchId: string) => void;
  teethRegistry?: import("@/lib/sales/zk-watch-teeth-draft").TeethDraftRegistryLookup;
  onRequestCloseWatch?: (watch: SalesZkWatch) => void;
  closePreviewLoading?: boolean;
  autoProsbaPending?: boolean;
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
  const noteProsbaState = useMemo(
    () => openZkLinkedOrdersWithCaseNoteState(watch, linkableOrders),
    [watch, linkableOrders]
  );
  const noteProsbaStatus = deriveZkCaseNoteProsbaStatus({
    note: watch.note,
    includeNoteInProsba: Boolean(watch.include_note_in_prosba),
    openOrderCount: noteProsbaState.openOrders.length,
    openOrdersWithMatchingNoteCount: noteProsbaState.withNote.length,
  });
  const noteProsbaPendingKind = deriveZkCaseNotePendingAttachKind(
    noteProsbaState.withoutNote
  );
  const noteProsbaCopy = zkCaseNoteProsbaStatusCopy(
    noteProsbaStatus,
    noteProsbaPendingKind
  );
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
  const regalWaitingCount = orderHints?.regalWaitingLineKeys?.length ?? 0;
  const hasRegalWaiting = regalWaitingCount > 0;
  const hasInformacjaReady = (orderHints?.informacjaReadyLineKeys?.length ?? 0) > 0;
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
    rawStockByTwId: prosbaRawStockByTwId,
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

  const teethDraftsIncomplete = useMemo(() => {
    if (!teethRegistry) return false;
    if (prosbaCardAction.kind !== "new_prosba" && prosbaCardAction.kind !== "supplement") {
      return false;
    }
    // Przed ustaleniem zakresu nie wymagaj list — modal early draft odpala się po zapisie scope.
    if (!prosbaScopeConfigured && teethRegistry.catalogAvailable !== false) {
      return false;
    }
    return !zkWatchTeethDraftsReady(watch, teethRegistry, {
      lineKeys: prosbaPrefillOptions?.lineKeys,
      requestKind: "zamowienie",
    });
  }, [
    teethRegistry,
    watch,
    prosbaCardAction.kind,
    prosbaPrefillOptions?.lineKeys,
    prosbaScopeConfigured,
  ]);

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

  const attentionInput = {
    archived,
    hasNewWarehouseArrival,
    followUpDue,
    followUpLabel: followUpDue ? formatFollowUpLabel(watch.follow_up_at) : null,
    regalWaitingCount,
    hasRegalWaiting,
    hasInformacjaReady,
    hasNewZkLines,
    isNewlyAdded,
    readyToClose,
    hiddenOutsideScope,
  };
  const primaryAttention = deriveZkWatchRowAttention(attentionInput);
  const followUpDueBadge = deriveZkWatchFollowUpDueBadge(attentionInput);
  const rowChrome = deriveZkWatchRowChrome(attentionInput);
  const prosbaRowMeta = prosbaScopeConfigured
    ? formatZkWatchProsbaRowMeta(displayProsbaCardAction)
    : null;
  const cardMetaSummary = buildZkWatchCardMetaSummary({
    prosbaScopeSummary,
    prosbaRowMeta,
    lineStatusSummary,
    secondaryMeta: deriveZkWatchRowSecondaryMeta(attentionInput),
    primaryAttention,
  });

  const prosbaActionCount = uncoveredLineKeys.length;

  function handleProsbaClick(event: MouseEvent<HTMLAnchorElement>) {
    if (teethDraftsIncomplete) {
      event.preventDefault();
      onTeethDraftRequested?.(watch.id);
      return;
    }
    setProsbaStockArmed(true);
    const ok = stashZkProsbaPrefill(watch, {
      ...prosbaPrefillOptions,
      stockByTwId: prosbaRawStockByTwId,
      ...(teethRegistry ? { teethRegistry } : {}),
    });
    if (!ok) {
      event.preventDefault();
      setError({
        watchId: watch.id,
        message: teethDraftsIncomplete
          ? "Najpierw uzupełnij listę zębów dla pozycji ZK."
          : "Brak pozycji do dodania do prośby — odśwież ZK z Subiekta.",
      });
    }
  }

  function handleInformacjaClick(event: MouseEvent<HTMLAnchorElement>) {
    // Informacja nie wymaga list zębów — teeth gate dotyczy tylko zamówienia.
    setProsbaStockArmed(true);
    const ok = stashZkProsbaPrefill(watch, {
      ...prosbaPrefillOptions,
      requestKind: "informacja",
      stockByTwId: prosbaRawStockByTwId,
      ...(teethRegistry ? { teethRegistry } : {}),
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
  const canEditZkActions = canEdit && !delegatePreview;
  const informacjaHref =
    canEdit &&
    (prosbaCardAction.kind === "new_prosba" || prosbaCardAction.kind === "supplement")
      ? prosbaHrefFromZkWatch(watch, {
          ...prosbaPrefillOptions,
          requestKind: "informacja",
        })
      : null;
  const pending =
    restoring ||
    deleting ||
    refreshing ||
    closePreviewLoading ||
    autoProsbaPending;
  const showCardOverlay = closePreviewLoading || autoProsbaPending;

  const prosbaViewHref =
    displayProsbaCardAction.kind === "view_open" &&
    displayProsbaCardAction.label === "Odbierz w Moje"
      ? mojeClientHref
      : prosbaInTokuHref;

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
    primaryAttention?.label,
    followUpDueBadge?.label,
    cardMetaSummary,
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
        message: userFacingErrorText(e, "Nie udało się przywrócić ZK."),
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
        message: userFacingErrorText(e, "Nie udało się odświeżyć danych z Subiekta."),
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
        message: userFacingErrorText(e, "Nie udało się usunąć wpisu."),
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article
      id={anchorId}
      className={anchorId ? "scroll-mt-3 scroll-mb-3" : undefined}
    >
      <div
        className={cn(
          zkWatchRowShellClassForChrome(rowChrome, { archived }),
          showCardOverlay && actionLoadingVirtualItemScopeClass
        )}
      >
      {closePreviewLoading ? (
        <ActionLoadingOverlay message="Sprawdzam pozycje…" variant="section" />
      ) : null}
      {autoProsbaPending ? (
        <ActionLoadingOverlay message="Tworzę prośbę…" variant="section" />
      ) : null}
      {rowChrome.railKind ? <ZkWatchRowAttentionRail kind={rowChrome.railKind} /> : null}
      {rowChrome.accentKind ? <ZkWatchRowAccentRail kind={rowChrome.accentKind} /> : null}
      <div className="min-w-0 flex-1">
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
            <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
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
              {primaryAttention ? (
                <ZkWatchAttentionBadge
                  kind={primaryAttention.kind}
                  label={primaryAttention.label}
                  title={primaryAttention.title}
                />
              ) : null}
              {followUpDueBadge ? (
                <ZkWatchAttentionBadge
                  kind={followUpDueBadge.kind}
                  label={followUpDueBadge.label}
                  title={followUpDueBadge.title}
                />
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
              <div className="mt-0.5 flex min-w-0 items-baseline gap-1.5">
                {noteProsbaStatus !== "none" ? (
                  <ZkCaseNoteProsbaChip
                    status={noteProsbaStatus}
                    pendingKind={noteProsbaPendingKind}
                    variant="row"
                  />
                ) : null}
                <button
                  type="button"
                  data-zk-row-action=""
                  onClick={handleNoteClick}
                  className={cn(
                    "min-w-0 flex-1 truncate text-left",
                    salesTypography.rowMeta,
                    "text-slate-600 transition hover:text-indigo-900"
                  )}
                  title={noteProsbaCopy.description}
                >
                  {notePreview}
                </button>
              </div>
            ) : canEditZkActions ? (
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

        <div
          className={cn(
            mojeQueueRowActionsClass,
            (rowChrome.railKind || rowChrome.accentKind) &&
              zkWatchRowActionsMobileDividerClass
          )}
          data-zk-row-action=""
        >
          <div
            className={zkWatchRowActionBarClass}
            onMouseEnter={() => setProsbaStockArmed(true)}
            onFocusCapture={() => setProsbaStockArmed(true)}
            onMouseDown={() => setProsbaStockArmed(true)}
          >
            <ZkWatchProsbaActions
              archived={archived}
              pending={pending}
              prosbaCardAction={displayProsbaCardAction}
              prosbaHref={prosbaHref}
              prosbaInTokuHref={prosbaViewHref}
              onProsbaClick={handleProsbaClick}
              informacjaHref={informacjaHref}
              onInformacjaClick={handleInformacjaClick}
              uncoveredCount={prosbaActionCount}
              buttonLabel={prosbaButtonLabel}
              teethDraftsIncomplete={teethDraftsIncomplete}
              teethCatalogUnavailable={teethRegistry?.catalogAvailable === false}
              canEditTeethDrafts={canEdit}
              onTeethDraftRequested={() => onTeethDraftRequested?.(watch.id)}
            />

            {!archived ? (
              <ZkWatchFollowUpButton
                watch={watch}
                readOnly={readOnly || delegatePreview}
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
                canEditZkActions && productLineCount > 0
                  ? () => onProsbaScopeRequested?.(watch.id)
                  : undefined
              }
              onRefresh={canEditZkActions ? () => void refreshFromSubiekt() : undefined}
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
        <p className="border-t border-slate-100/90 px-3 py-1.5 text-xs text-red-600">
          {displayError}
        </p>
      ) : null}

      </div>
      </div>
    </article>
  );
}
