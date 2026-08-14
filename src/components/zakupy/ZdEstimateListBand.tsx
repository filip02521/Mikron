"use client";

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import {
  OverflowMenu,
  OverflowMenuItem,
  OverflowMenuLabel,
} from "@/components/ui/OverflowMenu";
import { IconSearch, IconX } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { checkboxBrandClass } from "@/lib/ui/ontime-theme";
import {
  panelToolbarIconButtonClass,
  panelToolbarSearchInputClass,
  zdEstimateListBandClass,
  zdEstimateListToolsLinkClass,
} from "@/lib/ui/ontime-theme";
import type { ZdEstimateListFilter } from "@/lib/orders/zd-estimate-prefs";
import { ZD_ESTIMATE_UI } from "@/lib/orders/zd-estimate-ui-copy";

export function ZdEstimateListBand({
  listFilter,
  onListFilterChange,
  reviewInGroupCount,
  excludedInGroupCount,
  listSearch,
  onListSearchChange,
  showStockDetail,
  onShowStockDetailChange,
  showZkColumn,
  onShowZkColumnChange,
  visibleCount,
  allVisibleSelected,
  selectedCount,
  onSelectAllVisible,
  disabled,
}: {
  listFilter: ZdEstimateListFilter;
  onListFilterChange: (v: ZdEstimateListFilter) => void;
  reviewInGroupCount: number;
  excludedInGroupCount: number;
  listSearch: string;
  onListSearchChange: (v: string) => void;
  showStockDetail: boolean;
  onShowStockDetailChange: (v: boolean) => void;
  showZkColumn: boolean;
  onShowZkColumnChange: (v: boolean) => void;
  visibleCount: number;
  allVisibleSelected: boolean;
  selectedCount: number;
  onSelectAllVisible: () => void;
  disabled?: boolean;
}) {
  const searchTrimmed = listSearch.trim().length > 0;

  return (
    <div className={zdEstimateListBandClass} role="region" aria-label="Filtr i szukanie listy">
      <div className="flex w-full min-w-0 flex-col gap-2.5 lg:flex-row lg:items-center lg:gap-3">
        <SegmentedControl
          ariaLabel="Filtr listy"
          value={listFilter}
          onChange={onListFilterChange}
          className="w-full justify-stretch sm:w-auto lg:shrink-0"
          touchFriendly
          options={[
            {
              value: "order",
              label: "Do ZD",
              title: "Ilość Do ZD > 0, bez wykluczonych",
            },
            {
              value: "all",
              label: "Wszystkie",
              title: "Pełny zakres — wykluczone oznaczone",
            },
            {
              value: "review",
              label: `Do weryfikacji${
                reviewInGroupCount > 0 ? ` (${reviewInGroupCount})` : ""
              }`,
              title:
                "Wątpliwe podbicie Do ZD (niska / średnia pewność sprzedaży)",
            },
            {
              value: "excluded",
              label: `Wykluczone${
                excludedInGroupCount > 0 ? ` (${excludedInGroupCount})` : ""
              }`,
              title: ZD_ESTIMATE_UI.excludedFilterTitle,
            },
          ]}
        />

        <div className="relative min-w-0 flex-1 sm:max-w-[18rem] lg:max-w-[16rem]">
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

        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <div className="hidden items-center gap-3 sm:flex">
            <label
              className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600"
              title="Pokazuje kolumny Stan i Rezerwacje (obok Dostępne)"
            >
              <input
                type="checkbox"
                className={cn(checkboxBrandClass, "!size-3.5")}
                checked={showStockDetail}
                onChange={(e) => onShowStockDetailChange(e.target.checked)}
              />
              Stan / rez.
            </label>
            <label
              className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600"
              title="Kolumny diagnostyczne ZK i ilości z API Subiekta"
            >
              <input
                type="checkbox"
                className={cn(checkboxBrandClass, "!size-3.5")}
                checked={showZkColumn}
                onChange={(e) => onShowZkColumnChange(e.target.checked)}
              />
              ZK / API
            </label>
          </div>

          <div className="sm:hidden">
            <OverflowMenu
              label="Kolumny listy"
              align="end"
              iconOnly
              triggerClassName={panelToolbarIconButtonClass}
            >
              <OverflowMenuLabel>Kolumny</OverflowMenuLabel>
              <OverflowMenuItem
                onClick={() => onShowStockDetailChange(!showStockDetail)}
              >
                {showStockDetail ? "Ukryj" : "Pokaż"} Stan / rez.
              </OverflowMenuItem>
              <OverflowMenuItem
                onClick={() => onShowZkColumnChange(!showZkColumn)}
              >
                {showZkColumn ? "Ukryj" : "Pokaż"} ZK / API
              </OverflowMenuItem>
            </OverflowMenu>
          </div>

          {selectedCount > 0 ? null : visibleCount > 0 && !allVisibleSelected ? (
            <button
              type="button"
              className={cn(
                zdEstimateListToolsLinkClass,
                "text-xs text-slate-700 hover:text-slate-950"
              )}
              onClick={onSelectAllVisible}
              disabled={disabled}
            >
              Zaznacz widoczne ({visibleCount})
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
