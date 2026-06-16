"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import {
  panelChoiceChipClass,
  panelChoiceChipIdleClass,
  panelChoiceChipSelectedClass,
  panelChromeInsetClass,
  salesChromeInsetClass,
} from "@/lib/ui/ontime-theme";

export type DepartmentBoardTab = "announcements" | "questions";
export type DepartmentBoardQuestionFilter = "all" | "open" | "answered";

const TAB_CHIP_CLASS = cn(
  panelChoiceChipClass,
  "inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 py-2 sm:min-h-9"
);

const FILTER_CHIP_CLASS = cn(
  panelChoiceChipClass,
  "inline-flex min-h-10 shrink-0 cursor-pointer items-center px-2.5 py-1.5 text-[11px] sm:min-h-8"
);

export function DepartmentBoardTabBar({
  activeTab,
  onTabChange,
  domain,
  unreadAnnouncements = 0,
  activeAnnouncements = 0,
  openQuestions = 0,
  unseenAnswers = 0,
}: {
  activeTab: DepartmentBoardTab;
  onTabChange: (tab: DepartmentBoardTab) => void;
  domain: "sales" | "panel";
  unreadAnnouncements?: number;
  activeAnnouncements?: number;
  openQuestions?: number;
  unseenAnswers?: number;
}) {
  const inset = domain === "sales" ? salesChromeInsetClass : panelChromeInsetClass;

  const tabs: {
    id: DepartmentBoardTab;
    label: string;
    badge?: string;
  }[] =
    domain === "sales"
      ? [
          {
            id: "announcements",
            label: "Ogłoszenia od zakupów",
            badge:
              unreadAnnouncements > 0 ? `${unreadAnnouncements} nowe` : undefined,
          },
          {
            id: "questions",
            label: "Pytania zespołu",
            badge:
              unseenAnswers > 0
                ? `${unseenAnswers} nowe odp.`
                : openQuestions > 0
                  ? `${openQuestions} bez odp.`
                  : undefined,
          },
        ]
      : [
          {
            id: "announcements",
            label: "Ogłoszenia",
            badge:
              activeAnnouncements > 0 ? `${activeAnnouncements} aktyw.` : undefined,
          },
          {
            id: "questions",
            label: "Pytania",
            badge: openQuestions > 0 ? `${openQuestions} bez odp.` : undefined,
          },
        ];

  return (
    <div
      className={cn(
        "flex flex-wrap gap-2 border-b border-slate-100 bg-slate-50/60 py-2.5",
        inset
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
          >
            <span>{tab.label}</span>
            {tab.badge ? (
              <span className="tabular-nums text-[10px] font-semibold opacity-80">
                {tab.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** @deprecated Użyj DepartmentBoardTabBar z domain="sales". */
export const DepartmentBoardSalesTabBar = (
  props: Omit<ComponentProps<typeof DepartmentBoardTabBar>, "domain">
) => <DepartmentBoardTabBar {...props} domain="sales" />;

export function DepartmentBoardQuestionFilters({
  value,
  onChange,
  disabled = false,
}: {
  value: DepartmentBoardQuestionFilter;
  onChange: (value: DepartmentBoardQuestionFilter) => void;
  domain?: "sales" | "panel";
  disabled?: boolean;
}) {
  const filters = [
    ["all", "Wszystkie"],
    ["open", "Bez odpowiedzi"],
    ["answered", "Odpowiedziane"],
  ] as const;

  return (
    <div
      className="flex flex-wrap gap-1.5"
      role="group"
      aria-label="Filtr pytań"
    >
      {filters.map(([filter, label]) => {
        const active = value === filter;
        return (
          <button
            key={filter}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(filter)}
            className={cn(
              FILTER_CHIP_CLASS,
              active ? panelChoiceChipSelectedClass : panelChoiceChipIdleClass,
              disabled && "pointer-events-none opacity-60"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
