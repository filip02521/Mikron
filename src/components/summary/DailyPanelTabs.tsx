"use client";

import { cn } from "@/lib/cn";
import {
  dailyPanelViewLabel,
  type DailyPanelView,
} from "@/lib/orders/daily-panel-view";
import {
  panelStickyTabsClass,
  panelTabIdleClass,
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
  onChange,
}: {
  active: DailyPanelView;
  todayCount: number;
  weekCount: number;
  /** Niekompletne zgłoszenia — badge na zakładce „Dziś”. */
  verificationCount?: number;
  exceptionsCount?: number;
  onChange: (view: DailyPanelView) => void;
}) {
  const counts: Record<DailyPanelView, number | undefined> = {
    dzis: todayCount,
    tydzien: weekCount,
    wyjatki: exceptionsCount > 0 ? exceptionsCount : undefined,
  };

  return (
    <div
      role="tablist"
      aria-label="Widoki panelu dziennego"
      className={cn(
        panelStickyTabsClass,
        "flex gap-2 overflow-x-auto px-4 py-3 [-ms-overflow-style:none] [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden"
      )}
    >
      {TAB_ORDER.map((id) => {
        const selected = active === id;
        const count = counts[id];
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            id={`panel-tab-${id}`}
            aria-controls={`panel-view-${id}`}
            onClick={() => onChange(id)}
            className={cn(
              "flex min-h-10 shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition",
              selected ? tabSelectedClass : panelTabIdleClass
            )}
          >
            {dailyPanelViewLabel(id)}
            {count !== undefined && count > 0 ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                  selected ? tabBadgeSelectedClass : "bg-slate-100 text-slate-700"
                )}
              >
                {count}
              </span>
            ) : null}
            {id === "dzis" && verificationCount > 0 ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
                  selected
                    ? "bg-amber-500 text-white"
                    : "border border-amber-300 bg-amber-100 text-amber-950"
                )}
                title="Wymaga uzupełnienia danych"
              >
                +{verificationCount}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
