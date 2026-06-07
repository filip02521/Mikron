"use client";

import { useCallback, useRef } from "react";
import { cn } from "@/lib/cn";
import {
  dailyPanelViewLabel,
  type DailyPanelView,
} from "@/lib/orders/daily-panel-view";
import {
  panelChromeInsetClass,
  panelStickyChromeClass,
  panelTabIdleClass,
  panelTypography,
  tabBadgeSelectedClass,
  tabSelectedClass,
} from "@/lib/ui/ontime-theme";

const TAB_ORDER: DailyPanelView[] = ["dzis", "tydzien", "wyjatki"];

export function DailyPanelTabs({
  active,
  todayCount,
  weekCount,
  verificationCount = 0,
  exceptionsCount = 0,
  hideVerificationBadge = false,
  onChange,
  footer,
  afterFooter,
}: {
  active: DailyPanelView;
  todayCount: number;
  weekCount: number;
  verificationCount?: number;
  hideVerificationBadge?: boolean;
  exceptionsCount?: number;
  onChange: (view: DailyPanelView) => void;
  footer?: React.ReactNode;
  /** Pod stopką zakładek (np. pasek statusu Dziś) — scrolluje razem ze sticky chrome. */
  afterFooter?: React.ReactNode;
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

  return (
    <div className={panelStickyChromeClass}>
      <div
        role="tablist"
        aria-label="Widoki panelu dziennego"
        className={cn(
          "flex gap-2 overflow-x-auto py-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:py-2.5 [&::-webkit-scrollbar]:hidden",
          panelChromeInsetClass
        )}
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
              "flex min-h-11 shrink-0 items-center gap-2 rounded-md border px-3 py-2 transition sm:min-h-9 sm:py-1.5",
              panelTypography.tab,
              selected ? tabSelectedClass : panelTabIdleClass
            )}
          >
            {dailyPanelViewLabel(id)}
            {count !== undefined && count > 0 ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 tabular-nums",
                  panelTypography.tabBadge,
                  selected ? tabBadgeSelectedClass : "bg-slate-100 text-slate-700"
                )}
              >
                {count}
              </span>
            ) : null}
            {verificationBadge > 0 ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  selected ? "bg-amber-200 text-amber-950" : "bg-amber-100 text-amber-900"
                )}
                title="Zgłoszenia do uzupełnienia w weryfikacji"
              >
                {verificationBadge}
              </span>
            ) : null}
          </button>
        );
      })}
      </div>
      {footer}
      {afterFooter}
    </div>
  );
}
