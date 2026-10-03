"use client";

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import {
  OverflowMenu,
  OverflowMenuItem,
  OverflowMenuLabel,
  OverflowMenuSeparator,
} from "@/components/ui/OverflowMenu";
import { HelpHintBubble } from "@/components/ui/HelpHintBubble";
import {
  IconChevronDown,
  IconSearch,
  IconSettings,
  IconX,
} from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import {
  zdEstimateChromeGapClass,
  zdEstimateListBandClass,
  zdEstimateStatusNoteClass,
  zdEstimateToolbarIconClass,
  zdEstimateToolbarSearchClass,
} from "@/lib/ui/ontime-theme";
import {
  type ZdEstimateColumnVisibility,
  type ZdEstimateListFilter,
  type ZdEstimateOptionalColumn,
} from "@/lib/orders/zd-estimate-prefs";
import {
  ZD_ESTIMATE_UI,
  ZD_ESTIMATE_UNITS_LEGEND,
} from "@/lib/orders/zd-estimate-ui-copy";

function filterCountSuffix(count: number): string {
  return count > 0 ? ` (${count})` : "";
}

function ColumnToggleRow({
  columnKey,
  visible,
  index,
  total,
  onToggle,
  onMove,
}: {
  columnKey: ZdEstimateOptionalColumn;
  visible: boolean;
  index: number;
  total: number;
  onToggle: (key: ZdEstimateOptionalColumn) => void;
  onMove: (key: ZdEstimateOptionalColumn, direction: "up" | "down") => void;
}) {
  const canUp = index > 0;
  const canDown = index < total - 1;

  return (
    <div
      className="flex items-stretch gap-0.5 pr-1.5"
      role="none"
    >
      <OverflowMenuItem
        keepOpen
        onClick={() => onToggle(columnKey)}
        title={ZD_ESTIMATE_UI.listColumnToggleHint}
        className="flex min-w-0 flex-1 items-center gap-2 py-2"
      >
        <span
          className={cn(
            "inline-flex size-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold leading-none",
            visible
              ? "border-indigo-400 bg-indigo-50 text-indigo-800"
              : "border-slate-200 bg-white text-transparent"
          )}
          aria-hidden
        >
          ✓
        </span>
        <span className="min-w-0 flex-1 truncate">
          {ZD_ESTIMATE_UI.listColumnLabels[columnKey]}
        </span>
      </OverflowMenuItem>
      <div className="flex shrink-0 flex-col justify-center gap-px py-1">
        <button
          type="button"
          className={cn(
            "inline-flex size-5 items-center justify-center rounded text-slate-400 transition",
            canUp
              ? "hover:bg-indigo-50 hover:text-indigo-800"
              : "cursor-not-allowed opacity-30"
          )}
          disabled={!canUp}
          title={ZD_ESTIMATE_UI.listColumnMoveUp}
          aria-label={ZD_ESTIMATE_UI.listColumnMoveUp}
          onClick={(event) => {
            event.stopPropagation();
            onMove(columnKey, "up");
          }}
        >
          <IconChevronDown
            size={12}
            strokeWidth={2.5}
            open
            className="block"
            aria-hidden
          />
        </button>
        <button
          type="button"
          className={cn(
            "inline-flex size-5 items-center justify-center rounded text-slate-400 transition",
            canDown
              ? "hover:bg-indigo-50 hover:text-indigo-800"
              : "cursor-not-allowed opacity-30"
          )}
          disabled={!canDown}
          title={ZD_ESTIMATE_UI.listColumnMoveDown}
          aria-label={ZD_ESTIMATE_UI.listColumnMoveDown}
          onClick={(event) => {
            event.stopPropagation();
            onMove(columnKey, "down");
          }}
        >
          <IconChevronDown size={12} strokeWidth={2.5} className="block" aria-hidden />
        </button>
      </div>
    </div>
  );
}

export function ZdEstimateListBand({
  listFilter,
  onListFilterChange,
  reviewInGroupCount,
  excludedInGroupCount,
  inScopeCount,
  listSearch,
  onListSearchChange,
  searchVisibleCount,
  searchTotalCount,
  statusNote,
  columns,
  columnOrder,
  onToggleColumn,
  onMoveColumn,
  onResetColumns,
  columnsAreDefault,
  onSortByConfidence,
  sortKeyIsConfidence,
  onSortByMinStock,
  sortKeyIsMinStock,
  visibleCount,
  allVisibleSelected,
  selectedCount,
  onSelectAllVisible,
  disabled,
  leadTimeHorizon,
  onLeadTimeHorizonToggle,
  salesSmoothing,
  onSalesSmoothingToggle,
}: {
  listFilter: ZdEstimateListFilter;
  onListFilterChange: (v: ZdEstimateListFilter) => void;
  reviewInGroupCount: number;
  excludedInGroupCount: number;
  /** Liczba pozycji w zakresie Subiekta — title filtra „Wszystkie”. */
  inScopeCount: number;
  listSearch: string;
  onListSearchChange: (v: string) => void;
  /** Gdy szukanie: widoczne / w filtrze. */
  searchVisibleCount?: number;
  searchTotalCount?: number;
  /** Truncated / trwały status — chip w rzędzie filtrów (bez osobnej linii pod belką). */
  statusNote?: string | null;
  columns: ZdEstimateColumnVisibility;
  columnOrder: readonly ZdEstimateOptionalColumn[];
  onToggleColumn: (key: ZdEstimateOptionalColumn) => void;
  onMoveColumn: (
    key: ZdEstimateOptionalColumn,
    direction: "up" | "down"
  ) => void;
  onResetColumns: () => void;
  columnsAreDefault: boolean;
  onSortByConfidence: () => void;
  sortKeyIsConfidence?: boolean;
  onSortByMinStock: () => void;
  sortKeyIsMinStock?: boolean;
  visibleCount: number;
  allVisibleSelected: boolean;
  selectedCount: number;
  onSelectAllVisible: () => void;
  disabled?: boolean;
  /** Opcja „Do kolejnej dostawy” — przełączenie od razu przelicza listę. */
  leadTimeHorizon?: boolean;
  onLeadTimeHorizonToggle?: (next: boolean) => void;
  salesSmoothing?: boolean;
  onSalesSmoothingToggle?: (next: boolean) => void;
}) {
  const searchTrimmed = listSearch.trim().length > 0;
  const showSearchCounts =
    searchTrimmed &&
    searchVisibleCount != null &&
    searchTotalCount != null;
  const canSelectVisible =
    selectedCount === 0 && visibleCount > 0 && !allVisibleSelected;

  return (
    <div
      className={zdEstimateListBandClass}
      role="region"
      aria-label="Filtr i szukanie listy"
    >
      <div
        className={cn(
          "flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
        )}
      >
        <div
          className={cn(
            "flex min-w-0 flex-1 items-center",
            zdEstimateChromeGapClass
          )}
        >
          <SegmentedControl
            ariaLabel="Filtr listy"
            value={listFilter}
            onChange={onListFilterChange}
            density="compact"
            className="min-w-0 flex-1 justify-stretch sm:w-auto sm:flex-none sm:shrink-0"
            options={[
              {
                value: "order",
                label: "Do ZD",
                title: ZD_ESTIMATE_UI.listFilterOrderTitle,
              },
              {
                value: "all",
                label: (
                  <>
                    <span className="sm:hidden">Wsz.</span>
                    <span className="hidden sm:inline">Wszystkie</span>
                  </>
                ),
                title: ZD_ESTIMATE_UI.listFilterAllTitleWithCount(inScopeCount),
              },
              {
                value: "review",
                label: (
                  <>
                    <span className="sm:hidden">
                      Wer.{filterCountSuffix(reviewInGroupCount)}
                    </span>
                    <span className="hidden sm:inline">
                      {ZD_ESTIMATE_UI.listFilterReviewShort}
                      {filterCountSuffix(reviewInGroupCount)}
                    </span>
                  </>
                ),
                title: ZD_ESTIMATE_UI.listFilterReviewTitle,
              },
              {
                value: "excluded",
                label: (
                  <>
                    <span className="sm:hidden">
                      Wykl.{filterCountSuffix(excludedInGroupCount)}
                    </span>
                    <span className="hidden sm:inline">
                      {ZD_ESTIMATE_UI.listFilterExcludedShort}
                      {filterCountSuffix(excludedInGroupCount)}
                    </span>
                  </>
                ),
                title: ZD_ESTIMATE_UI.excludedFilterTitle,
              },
            ]}
          />
          <span className="inline-flex shrink-0 items-center gap-1.5">
            <HelpHintBubble
              message={ZD_ESTIMATE_UNITS_LEGEND}
              tone="slate"
              size="sm"
              ariaLabel="Legenda jednostek listy"
            />
            {statusNote ? (
              <span
                className={zdEstimateStatusNoteClass}
                title={statusNote}
                role="status"
              >
                {statusNote}
              </span>
            ) : null}
          </span>
        </div>

        <div
          className={cn(
            "flex w-full min-w-0 items-center sm:ml-auto sm:w-auto",
            zdEstimateChromeGapClass
          )}
        >
          {onLeadTimeHorizonToggle ? (
            <label
              className={cn(
                "inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border px-2 text-[12px] font-medium",
                leadTimeHorizon
                  ? "border-indigo-300 bg-indigo-50 text-indigo-900"
                  : "border-slate-200 bg-white text-slate-600",
                disabled && "cursor-not-allowed opacity-50"
              )}
              title="Zamówienie do przyjazdu kolejnej dostawy (harmonogram + czas dostawy z historii). Zmiana przelicza listę; odznacz, żeby liczyć jak dotąd."
            >
              <input
                type="checkbox"
                className="size-3.5 accent-indigo-600"
                aria-label="Do kolejnej dostawy — uwzględnij czas dostawy i harmonogram"
                checked={Boolean(leadTimeHorizon)}
                disabled={disabled}
                onChange={(e) => onLeadTimeHorizonToggle(e.target.checked)}
              />
              <span className="hidden lg:inline">Do kolejnej dostawy</span>
              <span className="lg:hidden">Do dostawy</span>
            </label>
          ) : null}
          {onSalesSmoothingToggle ? (
            <label
              className={cn(
                "inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border px-2 text-[12px] font-medium",
                salesSmoothing
                  ? "border-indigo-300 bg-indigo-50 text-indigo-900"
                  : "border-slate-200 bg-white text-slate-600",
                disabled && "cursor-not-allowed opacity-50"
              )}
              title="Jednorazowe skoki i rzadka sprzedaż liczone z typowego miesiąca (profil 12 miesięcy), sprzedaż pod zrealizowane prośby poza tempem. Tylko obniża ilości. Zmiana przelicza listę; odznacz, żeby liczyć jak dotąd."
            >
              <input
                type="checkbox"
                className="size-3.5 accent-indigo-600"
                aria-label="Wygładź nietypową sprzedaż — skoki, rzadka sprzedaż, prośby"
                checked={Boolean(salesSmoothing)}
                disabled={disabled}
                onChange={(e) => onSalesSmoothingToggle(e.target.checked)}
              />
              <span className="hidden lg:inline">Wygładź skoki</span>
              <span className="lg:hidden">Wygładź</span>
            </label>
          ) : null}
          <div className="relative min-w-0 flex-1 sm:w-[14rem] sm:flex-none md:w-[15rem] lg:w-[16rem]">
            <IconSearch
              size={14}
              strokeWidth={2}
              className="pointer-events-none absolute left-2 top-1/2 z-[1] -translate-y-1/2 text-slate-400 sm:left-2.5"
              aria-hidden
            />
            <label className="block w-full">
              <span className="sr-only">Szukaj symbol, nazwa, PLU, tw_Id</span>
              <input
                type="search"
                value={listSearch}
                onChange={(e) => onListSearchChange(e.target.value)}
                placeholder="Symbol, nazwa, PLU…"
                className={cn(
                  zdEstimateToolbarSearchClass,
                  "pl-7 sm:pl-8",
                  searchTrimmed || showSearchCounts ? "pr-12 sm:pr-14" : "pr-2.5 sm:pr-3"
                )}
              />
            </label>
            {showSearchCounts ? (
              <span
                className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 text-[11px] tabular-nums leading-none text-slate-500"
                title="Trafienia szukania / pozycje w aktywnym filtrze"
              >
                {searchVisibleCount}
                <span className="text-slate-300">/</span>
                {searchTotalCount}
              </span>
            ) : null}
            {searchTrimmed ? (
              <button
                type="button"
                className="absolute right-1 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition hover:bg-indigo-50/80 hover:text-indigo-900"
                onClick={() => onListSearchChange("")}
                aria-label="Wyczyść szukanie"
                title="Wyczyść szukanie"
              >
                <IconX size={13} strokeWidth={2.25} aria-hidden />
              </button>
            ) : null}
          </div>

          <OverflowMenu
            label={ZD_ESTIMATE_UI.listMoreMenuLabel}
            align="end"
            iconOnly
            triggerClassName={zdEstimateToolbarIconClass}
            menuClassName="min-w-[17rem]"
            triggerLeading={
              <IconSettings
                size={15}
                strokeWidth={2.25}
                className="block shrink-0"
                aria-hidden
              />
            }
          >
            <OverflowMenuLabel>{ZD_ESTIMATE_UI.listColumnMenuLabel}</OverflowMenuLabel>
            <p className="px-3 pb-1 text-[11px] leading-snug text-slate-500">
              {ZD_ESTIMATE_UI.listColumnAlwaysVisibleHint}.{" "}
              {ZD_ESTIMATE_UI.listColumnOrderHint}.
            </p>
            {columnOrder.map((key, index) => (
              <ColumnToggleRow
                key={key}
                columnKey={key}
                visible={columns[key]}
                index={index}
                total={columnOrder.length}
                onToggle={onToggleColumn}
                onMove={onMoveColumn}
              />
            ))}
            {!columnsAreDefault ? (
              <OverflowMenuItem keepOpen onClick={onResetColumns}>
                {ZD_ESTIMATE_UI.listColumnReset}
              </OverflowMenuItem>
            ) : null}
            <OverflowMenuSeparator />
            <OverflowMenuLabel>Sortowanie</OverflowMenuLabel>
            <OverflowMenuItem
              onClick={onSortByConfidence}
              disabled={disabled}
            >
              {sortKeyIsConfidence
                ? `✓ ${ZD_ESTIMATE_UI.listSortByConfidence}`
                : ZD_ESTIMATE_UI.listSortByConfidence}
            </OverflowMenuItem>
            <OverflowMenuItem
              onClick={onSortByMinStock}
              disabled={disabled}
            >
              {sortKeyIsMinStock
                ? `✓ ${ZD_ESTIMATE_UI.listSortByMinStock}`
                : ZD_ESTIMATE_UI.listSortByMinStock}
            </OverflowMenuItem>
            {canSelectVisible ? (
              <>
                <OverflowMenuLabel>Zaznaczenie</OverflowMenuLabel>
                <OverflowMenuItem
                  onClick={onSelectAllVisible}
                  disabled={disabled}
                >
                  {ZD_ESTIMATE_UI.listSelectVisible(visibleCount)}
                </OverflowMenuItem>
              </>
            ) : null}
          </OverflowMenu>
        </div>
      </div>
    </div>
  );
}
