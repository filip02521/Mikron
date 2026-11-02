"use client";

import { useCallback, useRef } from "react";
import { cn } from "@/lib/cn";
import {
  dailyPanelViewLabel,
  type DailyPanelView,
} from "@/lib/orders/daily-panel-view";


const TAB_ORDER: DailyPanelView[] = ["dzis", "tydzien", "wyjatki"];

export function DailyPanelTabs({
  active,
  todayCount,
  weekCount,
  verificationCount = 0,
  exceptionsCount = 0,
  hideVerificationBadge = false,
  onChange,
}: {
  active: DailyPanelView;
  todayCount: number;
  weekCount: number;
  verificationCount?: number;
  hideVerificationBadge?: boolean;
  exceptionsCount?: number;
  onChange: (view: DailyPanelView) => void;
}) {
  const tabRefs = useRef<Partial<Record<DailyPanelView, HTMLButtonElement | null>>>({});

  const focusTab = useCallback((view: DailyPanelView) => {
    tabRefs.current[view]?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, id: DailyPanelView) => {
      const idx = TAB_ORDER.indexOf(id);
      if (idx < 0) return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        const next = TAB_ORDER[(idx + 1) % TAB_ORDER.length]!;
        onChange(next);
        focusTab(next);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const next = TAB_ORDER[(idx - 1 + TAB_ORDER.length) % TAB_ORDER.length]!;
        onChange(next);
        focusTab(next);
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        onChange(TAB_ORDER[0]!);
        focusTab(TAB_ORDER[0]!);
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        const last = TAB_ORDER[TAB_ORDER.length - 1]!;
        onChange(last);
        focusTab(last);
      }
    },
    [onChange, focusTab]
  );

  const counts: Record<DailyPanelView, number | undefined> = {
    dzis: todayCount,
    tydzien: weekCount,
    wyjatki: exceptionsCount > 0 ? exceptionsCount : undefined,
  };

  const showVerificationChip =
    !hideVerificationBadge && verificationCount > 0;

  // Przełącznik widoku w stylu SegmentedControl (DESIGN.md → „Jedno wybrane”), z semantyką zakładek i strzałkami.
  return (
      <div
        role="tablist"
        aria-label="Widoki panelu dziennego"
        className="flex w-full max-w-full overflow-x-auto overscroll-x-contain rounded-md border border-slate-200/90 bg-slate-50/90 p-0.5 [scrollbar-width:thin] sm:inline-flex sm:w-auto"
      >
      {TAB_ORDER.map((id) => {
        const selected = active === id;
        const count = counts[id];
        const verificationBadge = id === "dzis" && showVerificationChip ? verificationCount : 0;
        return (
          <button
            key={id}
            ref={(el) => {
              tabRefs.current[id] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            id={`panel-tab-${id}`}
            aria-controls={`panel-view-${id}`}
            onClick={() => onChange(id)}
            onKeyDown={(e) => handleKeyDown(e, id)}
            className={cn(
              "flex min-h-11 flex-1 shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[5px] px-3 text-sm font-medium transition-[background-color,color,box-shadow] duration-150 ease-out sm:min-h-8 sm:flex-none",
              selected
                ? "bg-card text-slate-900 shadow-sm"
                : "text-slate-600 hover:bg-card/70 hover:text-slate-900"
            )}
          >
            {dailyPanelViewLabel(id)}
            {count !== undefined && count > 0 ? (
              <span className="text-xs font-normal tabular-nums text-slate-500">{count}</span>
            ) : null}
            {verificationBadge > 0 ? (
              <span
                className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[0.625rem] font-semibold tabular-nums text-amber-900"
                title="Zgłoszenia do uzupełnienia w weryfikacji"
              >
                {verificationBadge}
                <span className="sr-only"> do weryfikacji</span>
              </span>
            ) : null}
          </button>
        );
      })}
      </div>
  );
}
