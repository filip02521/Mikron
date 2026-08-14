"use client";

import { Button } from "@/components/ui/Button";
import {
  OverflowMenu,
  OverflowMenuItem,
  OverflowMenuLabel,
  OverflowMenuSeparator,
} from "@/components/ui/OverflowMenu";
import { cn } from "@/lib/cn";
import { ZD_ESTIMATE_BULK_MAX } from "@/lib/orders/zd-estimate-bulk";
import { ZD_ESTIMATE_UI } from "@/lib/orders/zd-estimate-ui-copy";
import { ZD_BOM_UI } from "@/lib/orders/zd-estimate-bom-copy";
import {
  resolveZdEstimateListToolsMode,
  resolveZdEstimateListToolStates,
  zdEstimateSelectionOutsideVisibleHint,
} from "@/lib/orders/zd-estimate-list-tools";
import {
  panelToolbarIconButtonClass,
  zdEstimateListToolsActionsClass,
  zdEstimateListToolsLinkClass,
  zdEstimateListToolsMetaClass,
  zdEstimateListToolsRowClass,
  zdEstimateSelectionBarClass,
} from "@/lib/ui/ontime-theme";

export type ZdEstimateListToolsBarProps = {
  selectedCount: number;
  visibleSelectedCount: number;
  excludeEligibleCount: number;
  restoreEligibleCount: number;
  packagingClearEligibleCount: number;
  onRequestEligibleCount?: number;
  clearOnRequestEligibleCount?: number;
  pairsTrusted?: boolean;
  bomsTrusted?: boolean;
  packagingTrusted?: boolean;
  exclusionsTrusted?: boolean;
  onRequestTrusted?: boolean;
  truncatedHint?: boolean;
  /** Blokuje akcje mutujące. */
  disabled?: boolean;
  onClearSelection: () => void;
  onBulkExclude: () => void;
  onBulkRestore: () => void;
  onBulkOnRequest?: () => void;
  onBulkClearOnRequest?: () => void;
  onBulkPackaging: () => void;
  onBulkClearPackaging: () => void;
  onCreatePair: () => void;
  onCreateBom: () => void;
  reviewEligibleCount?: number;
  onBulkReviewAccept?: () => void;
  onBulkReviewZero?: () => void;
};

/**
 * Pasek akcji grupowych — tylko przy zaznaczeniu (w flow nad tabelą).
 * Filtr / szukaj / „Zaznacz widoczne” są w belce listy.
 */
export function ZdEstimateListToolsBar({
  selectedCount,
  visibleSelectedCount,
  excludeEligibleCount,
  restoreEligibleCount,
  packagingClearEligibleCount,
  onRequestEligibleCount = 0,
  clearOnRequestEligibleCount = 0,
  pairsTrusted = true,
  bomsTrusted = true,
  packagingTrusted = true,
  exclusionsTrusted = true,
  onRequestTrusted = true,
  truncatedHint,
  disabled,
  onClearSelection,
  onBulkExclude,
  onBulkRestore,
  onBulkOnRequest,
  onBulkClearOnRequest,
  onBulkPackaging,
  onBulkClearPackaging,
  onCreatePair,
  onCreateBom,
  reviewEligibleCount = 0,
  onBulkReviewAccept,
  onBulkReviewZero,
}: ZdEstimateListToolsBarProps) {
  if (resolveZdEstimateListToolsMode(selectedCount) !== "selection") {
    return null;
  }

  const tools = resolveZdEstimateListToolStates({
    selectedCount,
    excludeEligibleCount,
    restoreEligibleCount,
    packagingClearEligibleCount,
    onRequestEligibleCount,
    clearOnRequestEligibleCount,
    pairsTrusted,
    bomsTrusted,
    packagingTrusted,
    exclusionsTrusted,
    onRequestTrusted,
  });
  const outsideHint = zdEstimateSelectionOutsideVisibleHint(
    selectedCount,
    visibleSelectedCount
  );

  return (
    <div
      className={zdEstimateSelectionBarClass}
      role="region"
      aria-label="Akcje grupowe zaznaczonych produktów"
    >
      <div className={zdEstimateListToolsRowClass}>
        <div className={zdEstimateListToolsMetaClass}>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-indigo-950">
            <span
              className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-xs font-bold tabular-nums text-white"
              aria-hidden
            >
              {selectedCount}
            </span>
            <span>
              {selectedCount === 1 ? "zaznaczony" : "zaznaczonych"}
            </span>
            {visibleSelectedCount > 0 &&
            visibleSelectedCount !== selectedCount ? (
              <span className="text-[11px] font-medium text-indigo-800/80">
                ({visibleSelectedCount} na tej stronie listy)
              </span>
            ) : null}
            {truncatedHint ? (
              <span className="text-[11px] font-medium text-amber-800">
                max {ZD_ESTIMATE_BULK_MAX}/akcję
              </span>
            ) : null}
            {outsideHint ? (
              <span className="text-[11px] font-medium text-slate-600">
                {outsideHint}
              </span>
            ) : null}
            <button
              type="button"
              className={cn(
                zdEstimateListToolsLinkClass,
                "text-[11px] font-medium text-slate-600 hover:text-slate-900"
              )}
              onClick={onClearSelection}
              disabled={disabled}
            >
              Odznacz
            </button>
          </p>
        </div>

        <div className={cn(zdEstimateListToolsActionsClass, "lg:justify-end")}>
          <Button
            type="button"
            size="sm"
            variant={tools.pair.accent ? "primary" : "secondary"}
            disabled={disabled || !tools.pair.enabled}
            onClick={onCreatePair}
            title={tools.pair.title}
          >
            Para
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tools.bom.accent ? "primary" : "secondary"}
            disabled={disabled || !tools.bom.enabled}
            onClick={onCreateBom}
            title={tools.bom.title}
            className={cn(selectedCount < 2 && "hidden sm:inline-flex")}
          >
            {ZD_BOM_UI.bulkButton}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tools.packagingSet.accent ? "primary" : "secondary"}
            disabled={disabled || !tools.packagingSet.enabled}
            onClick={onBulkPackaging}
            title={tools.packagingSet.title}
          >
            Opakowanie
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={disabled || !tools.packagingClear.enabled}
            onClick={onBulkClearPackaging}
            title={tools.packagingClear.title}
            className="hidden sm:inline-flex"
          >
            Usuń opak.{tools.packagingClear.labelSuffix}
          </Button>
          {onBulkReviewAccept ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={disabled || reviewEligibleCount <= 0}
              onClick={onBulkReviewAccept}
              title={ZD_ESTIMATE_UI.reviewAcceptHint}
            >
              {ZD_ESTIMATE_UI.reviewAcceptCta}
              {reviewEligibleCount > 0 ? ` (${reviewEligibleCount})` : ""}
            </Button>
          ) : null}
          {onBulkReviewZero ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={disabled || reviewEligibleCount <= 0}
              onClick={onBulkReviewZero}
              title={ZD_ESTIMATE_UI.reviewZeroHint}
            >
              {ZD_ESTIMATE_UI.reviewZeroCta}
            </Button>
          ) : null}
          {onBulkOnRequest ? (
            <Button
              type="button"
              size="sm"
              variant={tools.onRequest.accent ? "primary" : "secondary"}
              disabled={disabled || !tools.onRequest.enabled}
              onClick={onBulkOnRequest}
              title={tools.onRequest.title}
              className="hidden lg:inline-flex"
            >
              Na prośbę{tools.onRequest.labelSuffix}
            </Button>
          ) : null}
          {onBulkClearOnRequest ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={disabled || !tools.clearOnRequest.enabled}
              onClick={onBulkClearOnRequest}
              title={tools.clearOnRequest.title}
              className="hidden lg:inline-flex"
            >
              Usuń „tylko na prośbę”{tools.clearOnRequest.labelSuffix}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant={tools.restore.accent ? "primary" : "secondary"}
            disabled={disabled || !tools.restore.enabled}
            onClick={onBulkRestore}
            title={tools.restore.title}
            className="hidden sm:inline-flex"
          >
            Przywróć{tools.restore.labelSuffix}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="danger"
            disabled={disabled || !tools.exclude.enabled}
            onClick={onBulkExclude}
            title={tools.exclude.title}
          >
            Wyklucz{tools.exclude.labelSuffix}
          </Button>
          <OverflowMenu
            label="Więcej narzędzi listy"
            disabled={disabled}
            align="end"
            iconOnly
            className="sm:hidden"
            triggerClassName={panelToolbarIconButtonClass}
          >
            <OverflowMenuLabel>Akcje</OverflowMenuLabel>
            <OverflowMenuItem
              disabled={disabled || !tools.packagingClear.enabled}
              onClick={onBulkClearPackaging}
            >
              Usuń opak.{tools.packagingClear.labelSuffix}
            </OverflowMenuItem>
            {onBulkOnRequest ? (
              <OverflowMenuItem
                disabled={disabled || !tools.onRequest.enabled}
                onClick={onBulkOnRequest}
              >
                Tylko na prośbę{tools.onRequest.labelSuffix}
              </OverflowMenuItem>
            ) : null}
            {onBulkClearOnRequest ? (
              <OverflowMenuItem
                disabled={disabled || !tools.clearOnRequest.enabled}
                onClick={onBulkClearOnRequest}
              >
                Usuń „tylko na prośbę”{tools.clearOnRequest.labelSuffix}
              </OverflowMenuItem>
            ) : null}
            <OverflowMenuItem
              disabled={disabled || !tools.restore.enabled}
              onClick={onBulkRestore}
            >
              Przywróć{tools.restore.labelSuffix}
            </OverflowMenuItem>
            <OverflowMenuSeparator />
            <OverflowMenuItem disabled={disabled || selectedCount < 2} onClick={onCreateBom}>
              {ZD_BOM_UI.bulkButton}
            </OverflowMenuItem>
          </OverflowMenu>
        </div>
      </div>
    </div>
  );
}
