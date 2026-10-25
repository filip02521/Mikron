"use client";

import { cn } from "@/lib/cn";
import { DEPARTMENT_BOARD_QUESTIONS_FILTERS } from "@/lib/department-board/copy";
import type { DepartmentBoardQuestionFilterCounts } from "@/lib/department-board/question-filters";
import { DepartmentBoardCountBadge } from "@/components/department-board/DepartmentBoardCountBadge";
import {
  boardQuestionsAttentionChipActionIdleClass,
  boardQuestionsAttentionChipActiveClass,
  boardQuestionsAttentionChipClass,
  boardQuestionsAttentionChipIdleClass,
  boardQuestionsAttentionRowClass,
  boardQuestionsOwnUnseenHintClass,
  boardQuestionsStatusChipActiveClass,
  boardQuestionsStatusChipClass,
  boardQuestionsStatusChipIdleClass,
  boardQuestionsStatusTrackClass,
} from "@/lib/department-board/department-board-questions-ui";
import {
  panelChoiceChipClass,
  panelChoiceChipIdleClass,
  panelChoiceChipSelectedClass,
  salesTypography,
  controlFocusClass,
} from "@/lib/ui/ontime-theme";

export type DepartmentBoardTab = "announcements" | "questions";
export type DepartmentBoardQuestionFilter =
  | "all"
  | "open"
  | "answered"
  | "closed"
  | "unseen"
  | "own_unseen"
  | "mine";

/** Zakładki tablicy z podkreśleniem — ten sam wygląd co `SectionTabNav` (DESIGN.md → Navigation). */
const TAB_CLASS = cn(
  "-mb-px inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 border-b-2 px-0.5 text-sm font-medium transition-colors duration-150 sm:min-h-10",
  controlFocusClass
);

const STATUS_FILTERS: DepartmentBoardQuestionFilter[] = [
  "all",
  "open",
  "answered",
  "closed",
];

const FILTER_CHIP_TIPS: Record<DepartmentBoardQuestionFilter, string> =
  DEPARTMENT_BOARD_QUESTIONS_FILTERS.chips;

const FILTER_LABELS: Record<DepartmentBoardQuestionFilter, string> =
  DEPARTMENT_BOARD_QUESTIONS_FILTERS.labels;

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
      count: openQuestions > 0 ? openQuestions : totalQuestions,
      countEmphasis: openQuestions > 0 ? "warning" : "default",
      hint:
        openQuestions > 0
          ? `${openQuestions} bez odpowiedzi · łącznie ${totalQuestions}`
          : totalQuestions > 0
            ? `${totalQuestions} pytań`
            : undefined,
    },
  ];

  return (
    <div
      className="mb-5 flex gap-5 overflow-x-auto border-b border-slate-200 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-6"
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
              TAB_CLASS,
              active
                ? "border-indigo-600 text-slate-900"
                : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
            )}
            title={tab.hint}
          >
            <span>{tab.label}</span>
            <DepartmentBoardCountBadge count={tab.count} emphasis={tab.countEmphasis} />
            {tab.hint && !active ? (
              <span className="sr-only"> - {tab.hint}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function StatusFilterChip({
  id,
  count,
  active,
  disabled,
  onSelect,
  compact = false,
}: {
  id: DepartmentBoardQuestionFilter;
  count: number;
  active: boolean;
  disabled?: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  const countEmphasis =
    id === "open" && count > 0 && !active ? "warning" : "default";

  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      title={FILTER_CHIP_TIPS[id]}
      onClick={onSelect}
      className={cn(
        compact
          ? boardQuestionsStatusChipClass
          : cn(
              panelChoiceChipClass,
              "inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-1 px-2.5 py-1.5 text-[0.6875rem] sm:min-h-8"
            ),
        compact
          ? active
            ? boardQuestionsStatusChipActiveClass
            : boardQuestionsStatusChipIdleClass
          : active
            ? panelChoiceChipSelectedClass
            : panelChoiceChipIdleClass,
        disabled && "pointer-events-none opacity-60"
      )}
    >
      <span>{FILTER_LABELS[id]}</span>
      <DepartmentBoardCountBadge
        count={count}
        active={active}
        emphasis={active ? "default" : countEmphasis}
      />
    </button>
  );
}

function AttentionFilterChip({
  id,
  count,
  active,
  disabled,
  onSelect,
  actionTone = false,
}: {
  id: DepartmentBoardQuestionFilter;
  count: number;
  active: boolean;
  disabled?: boolean;
  onSelect: () => void;
  actionTone?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      title={FILTER_CHIP_TIPS[id]}
      onClick={onSelect}
      className={cn(
        boardQuestionsAttentionChipClass,
        active
          ? boardQuestionsAttentionChipActiveClass
          : actionTone
            ? boardQuestionsAttentionChipActionIdleClass
            : boardQuestionsAttentionChipIdleClass,
        disabled && "pointer-events-none opacity-60"
      )}
    >
      <span>{FILTER_LABELS[id]}</span>
      <DepartmentBoardCountBadge
        count={count}
        active={active}
        emphasis={active ? "default" : actionTone ? "action" : "default"}
      />
    </button>
  );
}

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
  const salesLayout = domain === "sales";
  const showMineChip = showMine && (counts.mine > 0 || value === "mine");
  const showUnseenChip = showUnseen || value === "unseen";
  // Rząd tylko z widocznym chipem — sam napis „Dla Ciebie” bez chipów był pustą etykietą.
  const showAttentionRow = salesLayout && (showMineChip || showUnseenChip);

  return (
    <div className="space-y-2.5">
      {salesLayout ? (
        <div>
          {/* Pasek filtrów bez etykiet nad kontrolkami — nazwę niesie aria-label (DESIGN.md). */}
          <div
            className={boardQuestionsStatusTrackClass}
            role="group"
            aria-label={DEPARTMENT_BOARD_QUESTIONS_FILTERS.statusGroupLabel}
          >
            {STATUS_FILTERS.map((id) => (
              <StatusFilterChip
                key={id}
                id={id}
                count={counts[id]}
                active={value === id}
                disabled={disabled}
                compact
                onSelect={() => onChange(id)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Filtr pytań"
        >
          {STATUS_FILTERS.map((id) => (
            <StatusFilterChip
              key={id}
              id={id}
              count={counts[id]}
              active={value === id}
              disabled={disabled}
              onSelect={() => onChange(id)}
            />
          ))}
        </div>
      )}

      {showAttentionRow ? (
        <div
          className={boardQuestionsAttentionRowClass}
          role="group"
          aria-label={DEPARTMENT_BOARD_QUESTIONS_FILTERS.attentionGroupLabel}
        >
          {showUnseenChip ? (
            <AttentionFilterChip
              id="unseen"
              count={counts.unseen}
              active={value === "unseen"}
              disabled={disabled}
              actionTone
              onSelect={() => onChange("unseen")}
            />
          ) : null}
          {showMineChip ? (
            <AttentionFilterChip
              id="mine"
              count={counts.mine}
              active={value === "mine"}
              disabled={disabled}
              onSelect={() => onChange("mine")}
            />
          ) : null}
        </div>
      ) : null}

      {value === "own_unseen" ? (
        <div className={boardQuestionsOwnUnseenHintClass} role="status">
          <span>{DEPARTMENT_BOARD_QUESTIONS_FILTERS.ownUnseenActiveHint}</span>
          <button
            type="button"
            disabled={disabled}
            className="shrink-0 text-xs font-semibold text-indigo-800 underline-offset-2 hover:underline disabled:opacity-60"
            onClick={() => onChange("all")}
          >
            {DEPARTMENT_BOARD_QUESTIONS_FILTERS.ownUnseenClearLabel}
          </button>
        </div>
      ) : null}

      {disabled && disabledReason ? (
        <p className={cn(salesTypography.sectionHint, domain === "panel" && "text-xs")}>
          {disabledReason}
        </p>
      ) : null}
    </div>
  );
}
