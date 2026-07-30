"use client";

import {
  DepartmentBoardQuestionFilters,
  type DepartmentBoardQuestionFilter,
} from "@/components/department-board/DepartmentBoardSalesChrome";
import { NotatnikListFilterBar } from "@/components/notatnik/NotatnikListFilterBar";
import {
  boardQuestionsResultsMetaClass,
  boardQuestionsToolbarShellClass,
} from "@/lib/department-board/department-board-questions-ui";
import type { DepartmentBoardQuestionFilterCounts } from "@/lib/department-board/question-filters";
import { salesSearchPlaceholder } from "@/lib/sales/sales-search-ui";
import { SALES_SEARCH_COPY } from "@/lib/sales/sales-page-ui-copy";
import { cn } from "@/lib/cn";

export function DepartmentBoardQuestionToolbar({
  domain,
  filter,
  onFilterChange,
  filtersDisabled,
  filtersDisabledReason,
  search,
  onSearchChange,
  matchCount,
  totalCount,
  showSearch,
  filterCounts,
  showMine = false,
  showUnseen = false,
  searchLabel,
  searchActive = false,
}: {
  domain: "sales" | "panel";
  filter: DepartmentBoardQuestionFilter;
  onFilterChange: (value: DepartmentBoardQuestionFilter) => void;
  filtersDisabled?: boolean;
  filtersDisabledReason?: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  matchCount: number;
  totalCount: number;
  showSearch: boolean;
  filterCounts: DepartmentBoardQuestionFilterCounts;
  showMine?: boolean;
  showUnseen?: boolean;
  searchLabel: string;
  searchActive?: boolean;
}) {
  const showResultsMeta = showSearch && (searchActive || matchCount !== totalCount);

  return (
    <div className={boardQuestionsToolbarShellClass}>
      {showSearch ? (
        <NotatnikListFilterBar
          embedded
          bleed
          compact
          value={search}
          onChange={onSearchChange}
          matchCount={matchCount}
          totalCount={totalCount}
          placeholder={salesSearchPlaceholder(SALES_SEARCH_COPY.boardQuestions)}
          searchLabel={searchLabel}
          showIdleHint={false}
          showActiveDetail={false}
          emptyMatchHint="Brak dopasowań — sprawdź temat, treść, autora lub odpowiedź."
        />
      ) : null}

      <DepartmentBoardQuestionFilters
        domain={domain}
        value={filter}
        onChange={onFilterChange}
        disabled={filtersDisabled}
        disabledReason={filtersDisabledReason}
        counts={filterCounts}
        showMine={showMine}
        showUnseen={showUnseen}
      />

      {showResultsMeta ? (
        <p className={cn(boardQuestionsResultsMetaClass, "px-0.5")}>
          {searchActive ? (
            <>
              Wyniki wyszukiwania:{" "}
              <span className="font-semibold text-slate-700">{matchCount}</span>
              {" z "}
              <span className="font-semibold text-slate-700">{totalCount}</span>
              {" w filtrze"}
            </>
          ) : (
            <>
              <span className="font-semibold text-slate-700">{matchCount}</span>
              {" wątków w filtrze"}
            </>
          )}
        </p>
      ) : null}
    </div>
  );
}
