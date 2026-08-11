"use client";

import { Button } from "@/components/ui/Button";
import {
  OverflowMenu,
  OverflowMenuItem,
  OverflowMenuLabel,
  OverflowMenuSeparator,
} from "@/components/ui/OverflowMenu";
import { IconSearch, IconX } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { ZD_ESTIMATE_BULK_MAX } from "@/lib/orders/zd-estimate-bulk";
import { ZD_BOM_UI } from "@/lib/orders/zd-estimate-bom-copy";
import {
  resolveZdEstimateListToolStates,
  resolveZdEstimateListToolsMode,
  zdEstimateSelectionOutsideVisibleHint,
} from "@/lib/orders/zd-estimate-list-tools";
import {
  panelToolbarIconButtonClass,
  panelToolbarSearchInputClass,
  zdEstimateListToolsActionsClass,
  zdEstimateListToolsLinkClass,
  zdEstimateListToolsMetaClass,
  zdEstimateListToolsRowClass,
  zdEstimateListToolsSearchWrapClass,
  zdEstimateListToolsShellActiveClass,
  zdEstimateListToolsShellClass,
  zdEstimateListToolsShellQuietClass,
} from "@/lib/ui/ontime-theme";

export type ZdEstimateListToolsBarProps = {
  selectedCount: number;
  visibleSelectedCount: number;
  visibleCount: number;
  allVisibleSelected: boolean;
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
  /** Blokuje akcje mutujące — szukaj/clear zostaje aktywne (filtr client-side). */
  disabled?: boolean;
  listSearch: string;
  onListSearchChange: (value: string) => void;
  onSelectAllVisible: () => void;
  onClearSelection: () => void;
  onBulkExclude: () => void;
  onBulkRestore: () => void;
  onBulkOnRequest?: () => void;
  onBulkClearOnRequest?: () => void;
  onBulkPackaging: () => void;
  onBulkClearPackaging: () => void;
  onCreatePair: () => void;
  onCreateBom: () => void;
  onOpenExclusionsPanel: () => void;
  onOpenOnRequestPanel?: () => void;
  onOpenPackagingPanel: () => void;
  onOpenPairsPanel: () => void;
  onOpenBomsPanel: () => void;
  exclusionsCount?: number;
  onRequestsCount?: number;
  packagingCount?: number;
  pairsCount?: number;
  bomsCount?: number;
};

function countSuffix(n: number | undefined): string {
  return n != null && n > 0 ? ` (${n})` : "";
}

export function ZdEstimateListToolsBar({
  selectedCount,
  visibleSelectedCount,
  visibleCount,
  allVisibleSelected,
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
  listSearch,
  onListSearchChange,
  onSelectAllVisible,
  onClearSelection,
  onBulkExclude,
  onBulkRestore,
  onBulkOnRequest,
  onBulkClearOnRequest,
  onBulkPackaging,
  onBulkClearPackaging,
  onCreatePair,
  onCreateBom,
  onOpenExclusionsPanel,
  onOpenOnRequestPanel,
  onOpenPackagingPanel,
  onOpenPairsPanel,
  onOpenBomsPanel,
  exclusionsCount = 0,
  onRequestsCount = 0,
  packagingCount = 0,
  pairsCount = 0,
  bomsCount = 0,
}: ZdEstimateListToolsBarProps) {
  const mode = resolveZdEstimateListToolsMode(selectedCount);
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
  const selectionActive = mode === "selection";
  const searchTrimmed = listSearch.trim().length > 0;

  const panelButtons = [
    {
      key: "packaging",
      label: `Opakowania${countSuffix(packagingCount)}`,
      title: "Panel opakowań działu",
      onClick: onOpenPackagingPanel,
      mobilePrimary: true,
    },
    {
      key: "pairs",
      label: `Pary${countSuffix(pairsCount)}`,
      title: "Panel par montaż/demontaż",
      onClick: onOpenPairsPanel,
      mobilePrimary: true,
    },
    {
      key: "boms",
      label: `${ZD_BOM_UI.panelTitle}${countSuffix(bomsCount)}`,
      title: "Panel składów i promocji",
      onClick: onOpenBomsPanel,
      mobilePrimary: false,
    },
    {
      key: "exclusions",
      label: `Wykluczenia${countSuffix(exclusionsCount)}`,
      title: "Panel wykluczeń działu",
      onClick: onOpenExclusionsPanel,
      mobilePrimary: false,
    },
    ...(onOpenOnRequestPanel
      ? [
          {
            key: "onRequest" as const,
            label: `Tylko na prośbę${countSuffix(onRequestsCount)}`,
            title: "Panel „tylko na prośbę”",
            onClick: onOpenOnRequestPanel,
            mobilePrimary: false,
          },
        ]
      : []),
  ] as const;

  const departmentOverflow = (
    <OverflowMenu
      label="Ustawienia działu"
      disabled={disabled}
      align="end"
      iconOnly
      triggerClassName={panelToolbarIconButtonClass}
    >
      <OverflowMenuLabel>Panele działu</OverflowMenuLabel>
      {panelButtons.map((p) => (
        <OverflowMenuItem key={p.key} disabled={disabled} onClick={p.onClick}>
          {p.label}
        </OverflowMenuItem>
      ))}
    </OverflowMenu>
  );

  return (
    <div
      className={cn(
        zdEstimateListToolsShellClass,
        selectionActive
          ? zdEstimateListToolsShellActiveClass
          : zdEstimateListToolsShellQuietClass
      )}
      role="region"
      aria-label={
        selectionActive
          ? "Akcje grupowe zaznaczonych produktów"
          : "Narzędzia listy szacunku ZD"
      }
    >
      <div className={zdEstimateListToolsRowClass}>
        {/* Mobile-first: szukaj na górze — szybsze zawężanie listy. */}
        <div
          className={cn(
            zdEstimateListToolsSearchWrapClass,
            "order-1 lg:order-3"
          )}
        >
          <IconSearch
            size={15}
            strokeWidth={2}
            className="pointer-events-none absolute left-2.5 top-1/2 z-[1] -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <label className="block w-full">
            <span className="sr-only">Szukaj symbol, nazwa, PLU, tw_Id</span>
            <input
              type="search"
              value={listSearch}
              onChange={(e) => onListSearchChange(e.target.value)}
              placeholder="Symbol, nazwa, PLU, ID…"
              className={cn(
                panelToolbarSearchInputClass,
                "pl-8",
                searchTrimmed ? "pr-9" : "pr-3",
                "[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
              )}
            />
          </label>
          {searchTrimmed ? (
            <button
              type="button"
              className="absolute right-1.5 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition hover:bg-indigo-50/80 hover:text-indigo-900"
              onClick={() => onListSearchChange("")}
              aria-label="Wyczyść szukanie"
              title="Wyczyść szukanie"
            >
              <IconX size={14} strokeWidth={2.25} aria-hidden />
            </button>
          ) : null}
        </div>

        <div className={cn(zdEstimateListToolsMetaClass, "order-3 lg:order-1")}>
          {selectionActive ? (
            <>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-indigo-950">
                <span
                  className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-xs font-bold tabular-nums text-white"
                  aria-hidden
                >
                  {selectedCount}
                </span>
                <span>
                  {selectedCount === 1
                    ? "zaznaczony"
                    : "zaznaczonych"}
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
              </p>
              <p className="hidden text-[11px] leading-snug text-indigo-900/70 sm:block">
                Zmiany wykluczeń i opakowań zapisują się dla całego działu.
              </p>
            </>
          ) : (
            <p className="text-[11px] leading-snug text-slate-600">
              Zaznacz wiersze do akcji — albo otwórz panele działu.
            </p>
          )}
          <div
            className={cn(
              "flex flex-wrap gap-x-3 gap-y-1 text-[11px]",
              selectionActive ? "text-indigo-800" : "text-slate-600"
            )}
          >
            {visibleCount > 0 && !allVisibleSelected ? (
              <button
                type="button"
                className={cn(
                  zdEstimateListToolsLinkClass,
                  selectionActive
                    ? "text-indigo-700 hover:text-indigo-950"
                    : "text-slate-700 hover:text-slate-950"
                )}
                onClick={onSelectAllVisible}
                disabled={disabled}
              >
                Zaznacz widoczne ({visibleCount})
              </button>
            ) : null}
            {selectedCount > 0 ? (
              <button
                type="button"
                className={cn(
                  zdEstimateListToolsLinkClass,
                  "text-slate-600 hover:text-slate-900"
                )}
                onClick={onClearSelection}
                disabled={disabled}
              >
                Odznacz
              </button>
            ) : null}
          </div>
        </div>

        <div
          className={cn(zdEstimateListToolsActionsClass, "order-2 lg:order-2")}
        >
          {mode === "panels" ? (
            <>
              {panelButtons.map((p) => (
                <Button
                  key={p.key}
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={disabled}
                  onClick={p.onClick}
                  title={p.title}
                  className={cn(!p.mobilePrimary && "hidden sm:inline-flex")}
                >
                  {p.label}
                </Button>
              ))}
              <div className="sm:hidden">
                <OverflowMenu
                  label="Więcej paneli działu"
                  disabled={disabled}
                  align="end"
                  iconOnly
                  triggerClassName={panelToolbarIconButtonClass}
                >
                  <OverflowMenuLabel>Panele działu</OverflowMenuLabel>
                  {panelButtons
                    .filter((p) => !p.mobilePrimary)
                    .map((p) => (
                      <OverflowMenuItem
                        key={p.key}
                        disabled={disabled}
                        onClick={p.onClick}
                      >
                        {p.label}
                      </OverflowMenuItem>
                    ))}
                </OverflowMenu>
              </div>
            </>
          ) : (
            <>
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
                  Usuń prośbę{tools.clearOnRequest.labelSuffix}
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
                <OverflowMenuLabel>Panele działu</OverflowMenuLabel>
                {panelButtons.map((p) => (
                  <OverflowMenuItem
                    key={p.key}
                    disabled={disabled}
                    onClick={p.onClick}
                  >
                    {p.label}
                  </OverflowMenuItem>
                ))}
              </OverflowMenu>
              <div className="hidden sm:block">{departmentOverflow}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
