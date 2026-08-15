"use client";

import type { ReactNode } from "react";
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
  zdEstimateSelectionGroupButtonsClass,
  zdEstimateSelectionGroupClass,
  zdEstimateSelectionGroupDividerClass,
  zdEstimateSelectionGroupLabelClass,
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

function SelectionActionGroup({
  label,
  children,
  tone = "default",
  className,
}: {
  label: string;
  children: ReactNode;
  tone?: "default" | "danger";
  className?: string;
}) {
  return (
    <div
      className={cn(
        zdEstimateSelectionGroupClass,
        tone === "danger" &&
          "rounded-lg bg-red-50/50 px-2 py-1.5 ring-1 ring-red-100/80 sm:px-2.5",
        className
      )}
      role="group"
      aria-label={label}
    >
      <span
        className={cn(
          zdEstimateSelectionGroupLabelClass,
          tone === "danger" && "text-red-800/55"
        )}
      >
        {label}
      </span>
      <div className={zdEstimateSelectionGroupButtonsClass}>{children}</div>
    </div>
  );
}

function SelectionGroupDivider() {
  return <div className={zdEstimateSelectionGroupDividerClass} aria-hidden />;
}

/**
 * Pasek akcji grupowych — grupy wg typu: powiązania → jednostki → pewność →
 * reguły → zakres listy. Nad sticky Create.
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

  const showReviewGroup = Boolean(onBulkReviewAccept || onBulkReviewZero);
  const showRulesGroup = Boolean(onBulkOnRequest || onBulkClearOnRequest);

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
              {ZD_ESTIMATE_UI.selectionClearLabel}
            </button>
          </p>
        </div>

        <div className={zdEstimateListToolsActionsClass}>
          <SelectionActionGroup label={ZD_ESTIMATE_UI.selectionGroupRelations}>
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
          </SelectionActionGroup>

          <SelectionGroupDivider />

          <SelectionActionGroup label={ZD_ESTIMATE_UI.selectionGroupUnits}>
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
          </SelectionActionGroup>

          {showReviewGroup ? (
            <>
              <SelectionGroupDivider />
              <SelectionActionGroup label={ZD_ESTIMATE_UI.selectionGroupReview}>
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
                    {reviewEligibleCount > 0
                      ? ` (${reviewEligibleCount})`
                      : ""}
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
                    className="hidden sm:inline-flex"
                  >
                    {ZD_ESTIMATE_UI.reviewZeroCta}
                  </Button>
                ) : null}
              </SelectionActionGroup>
            </>
          ) : null}

          {showRulesGroup ? (
            <div className="hidden lg:contents">
              <SelectionGroupDivider />
              <SelectionActionGroup label={ZD_ESTIMATE_UI.selectionGroupRules}>
                {onBulkOnRequest ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={tools.onRequest.accent ? "primary" : "secondary"}
                    disabled={disabled || !tools.onRequest.enabled}
                    onClick={onBulkOnRequest}
                    title={tools.onRequest.title}
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
                  >
                    Usuń „tylko na prośbę”
                    {tools.clearOnRequest.labelSuffix}
                  </Button>
                ) : null}
              </SelectionActionGroup>
            </div>
          ) : null}

          <SelectionGroupDivider />

          <SelectionActionGroup
            label={ZD_ESTIMATE_UI.selectionGroupList}
            tone="danger"
          >
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
          </SelectionActionGroup>

          <div className="flex items-end sm:pl-1">
            <OverflowMenu
              label={ZD_ESTIMATE_UI.selectionMoreMenuLabel}
              disabled={disabled}
              align="end"
              iconOnly
              className={showRulesGroup ? "lg:hidden" : "sm:hidden"}
              triggerClassName={panelToolbarIconButtonClass}
            >
              <div className="sm:hidden">
                <OverflowMenuLabel>
                  {ZD_ESTIMATE_UI.selectionGroupRelations}
                </OverflowMenuLabel>
                {selectedCount < 2 ? (
                  <OverflowMenuItem
                    disabled={disabled || !tools.bom.enabled}
                    onClick={onCreateBom}
                  >
                    {ZD_BOM_UI.bulkButton}
                  </OverflowMenuItem>
                ) : null}
                <OverflowMenuSeparator />
                <OverflowMenuLabel>
                  {ZD_ESTIMATE_UI.selectionGroupUnits}
                </OverflowMenuLabel>
                <OverflowMenuItem
                  disabled={disabled || !tools.packagingClear.enabled}
                  onClick={onBulkClearPackaging}
                >
                  Usuń opak.{tools.packagingClear.labelSuffix}
                </OverflowMenuItem>
                {showReviewGroup && onBulkReviewZero ? (
                  <>
                    <OverflowMenuSeparator />
                    <OverflowMenuLabel>
                      {ZD_ESTIMATE_UI.selectionGroupReview}
                    </OverflowMenuLabel>
                    <OverflowMenuItem
                      disabled={disabled || reviewEligibleCount <= 0}
                      onClick={onBulkReviewZero}
                    >
                      {ZD_ESTIMATE_UI.reviewZeroCta}
                    </OverflowMenuItem>
                  </>
                ) : null}
                <OverflowMenuSeparator />
                <OverflowMenuLabel>
                  {ZD_ESTIMATE_UI.selectionGroupList}
                </OverflowMenuLabel>
                <OverflowMenuItem
                  disabled={disabled || !tools.restore.enabled}
                  onClick={onBulkRestore}
                >
                  Przywróć{tools.restore.labelSuffix}
                </OverflowMenuItem>
              </div>

              {showRulesGroup ? (
                <>
                  <div className="sm:hidden">
                    <OverflowMenuSeparator />
                  </div>
                  <OverflowMenuLabel>
                    {ZD_ESTIMATE_UI.selectionGroupRules}
                  </OverflowMenuLabel>
                  {onBulkOnRequest ? (
                    <OverflowMenuItem
                      disabled={disabled || !tools.onRequest.enabled}
                      onClick={onBulkOnRequest}
                    >
                      Na prośbę{tools.onRequest.labelSuffix}
                    </OverflowMenuItem>
                  ) : null}
                  {onBulkClearOnRequest ? (
                    <OverflowMenuItem
                      disabled={disabled || !tools.clearOnRequest.enabled}
                      onClick={onBulkClearOnRequest}
                    >
                      Usuń „tylko na prośbę”
                      {tools.clearOnRequest.labelSuffix}
                    </OverflowMenuItem>
                  ) : null}
                </>
              ) : null}
            </OverflowMenu>
          </div>
        </div>
      </div>
    </div>
  );
}
