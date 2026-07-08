"use client";

import { cn } from "@/lib/cn";
import { DEPARTMENT_BOARD_QUESTIONS_FILTERS } from "@/lib/department-board/copy";
import type { DepartmentBoardQuestionFilterCounts } from "@/lib/department-board/question-filters";
import { DepartmentBoardCountBadge } from "@/components/department-board/DepartmentBoardCountBadge";
import {
  panelChoiceChipClass,
  panelChoiceChipIdleClass,
  panelChoiceChipSelectedClass,
  panelChromeInsetClass,
  salesTypography,
} from "@/lib/ui/ontime-theme";
export type DepartmentBoardTab = "announcements" | "questions";
export type DepartmentBoardQuestionFilter = "all" | "open" | "answered" | "unseen" | "own_unseen" | "mine";

const TAB_CHIP_CLASS = cn(
  panelChoiceChipClass,
  "inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 py-2 sm:min-h-9"
);

const FILTER_CHIP_CLASS = cn(
  panelChoiceChipClass,
  "inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-1 px-2.5 py-1.5 text-[11px] sm:min-h-8"
);

const FILTER_CHIP_TIPS: Record<DepartmentBoardQuestionFilter, string> =
  DEPARTMENT_BOARD_QUESTIONS_FILTERS.chips;

export function DepartmentBoardTabBar({
  activeTab,
  onTabChange,
  activeAnnouncements = 0,
  totalQuestions = 0,
  openQuestions = 0,
}: {
  activeTab: DepartmentBoardTab;
  onTabChange: (tab: DepartmentBoardTab) => void;
  activeAnnouncements?: number;
  totalQuestions?: number;
  openQuestions?: number;
}) {
  const tabs: {
    id: DepartmentBoardTab;
    label: string;
    count: number;
    countEmphasis?: "default" | "warning" | "action";
    hint?: string;
  }[] = [
    {
      id: "announcements",
      label: "Ogłoszenia",
      count: activeAnnouncements,
    },
    {
      id: "questions",
      label: "Pytania",
      count: totalQuestions,
      countEmphasis: openQuestions > 0 ? "warning" : "default",
      hint: openQuestions > 0 ? `${openQuestions} bez odpowiedzi` : undefined,
    },
  ];

  return (
    <div
      className={cn(
        "flex flex-wrap gap-2 border-b border-slate-100 bg-slate-50/60 py-2.5",
        panelChromeInsetClass
      )}
      role="tablist"
      aria-label="Rodzaj wpisów na tablicy"
    >
      {tabs.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              TAB_CHIP_CLASS,
              active ? panelChoiceChipSelectedClass : panelChoiceChipIdleClass
            )}
            title={tab.hint}
          >
            <span>{tab.label}</span>
            <DepartmentBoardCountBadge
              count={tab.count}
              active={active}
              emphasis={active ? "default" : tab.countEmphasis}
            />
            {tab.hint && !active ? (
              <span className="sr-only"> — {tab.hint}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

type QuestionFilterChip = {
  id: DepartmentBoardQuestionFilter;
  label: string;
  count?: number;
};

export function DepartmentBoardQuestionFilters({
  value,
  onChange,
  disabled = false,
  disabledReason = null,
  domain = "sales",
  counts,
  showMine = false,
  showUnseen = false,
}: {
  value: DepartmentBoardQuestionFilter;
  onChange: (value: DepartmentBoardQuestionFilter) => void;
  domain?: "sales" | "panel";
  disabled?: boolean;
  disabledReason?: string | null;
  counts: DepartmentBoardQuestionFilterCounts;
  showMine?: boolean;
  showUnseen?: boolean;
}) {
  const filters: QuestionFilterChip[] = [
    { id: "all", label: "Wszystkie", count: counts.all },
    { id: "open", label: "Bez odpowiedzi", count: counts.open },
    { id: "answered", label: "Odpowiedziane", count: counts.answered },
  ];

  if (showUnseen && counts.unseen > 0) {
    filters.push({ id: "unseen", label: "Nowe odpowiedzi", count: counts.unseen });
  }

  if (showMine && counts.own_unseen > 0) {
    filters.push({
      id: "own_unseen",
      label: "Moje z nową odpowiedzią",
      count: counts.own_unseen,
    });
  }

  if (showMine) {
    filters.push({ id: "mine", label: "Tylko moje", count: counts.mine });
  }

  return (
    <div className="space-y-2">
      <p className={cn(salesTypography.sectionHint, "px-0.5")}>
        {DEPARTMENT_BOARD_QUESTIONS_FILTERS.toolbarHint}
      </p>
      <div
        className="flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label="Filtr pytań"
      >
        {filters.map((filter) => {
          const active = value === filter.id;
          const countEmphasis =
            filter.id === "open" && (filter.count ?? 0) > 0
              ? "warning"
              : filter.id === "unseen" || filter.id === "own_unseen"
                ? "action"
                : "default";
          return (
            <button
              key={filter.id}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              title={FILTER_CHIP_TIPS[filter.id]}
              onClick={() => onChange(filter.id)}
              className={cn(
                FILTER_CHIP_CLASS,
                active ? panelChoiceChipSelectedClass : panelChoiceChipIdleClass,
                disabled && "pointer-events-none opacity-60"
              )}
            >
              <span>{filter.label}</span>
              {filter.count != null ? (
                <DepartmentBoardCountBadge
                  count={filter.count}
                  active={active}
                  emphasis={active ? "default" : countEmphasis}
                />
              ) : null}
            </button>
          );
        })}
      </div>
      {disabled && disabledReason ? (
        <p className={cn(salesTypography.sectionHint, domain === "panel" && "text-xs")}>
          {disabledReason}
        </p>
      ) : null}
    </div>
  );
}
