"use client";

import { useCallback, useRef } from "react";
import { cn } from "@/lib/cn";
import {
  panelChromeInsetClass,
  panelStickyChromeClass,
  panelTabIdleClass,
  panelTypography,
  tabBadgeSelectedClass,
  tabSelectedClass,
} from "@/lib/ui/ontime-theme";
import type { Tab } from "@/components/zeby/teeth-panel-types";

const TAB_ORDER: Tab[] = ["kolejka", "historia", "harmonogram"];

const TAB_LABELS: Record<Tab, string> = {
  kolejka: "Kolejka",
  historia: "Historia",
  harmonogram: "Harmonogram",
};

export function TeethPanelTabs({
  active,
  queueCount,
  onChange,
  hint,
}: {
  active: Tab;
  queueCount: number;
  onChange: (tab: Tab) => void;
  hint?: string;
}) {
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});

  const focusTab = useCallback((tab: Tab) => {
    tabRefs.current[tab]?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, id: Tab) => {
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
    [onChange, focusTab],
  );

  return (
    <div className={panelStickyChromeClass}>
      <div
        role="tablist"
        aria-label="Widoki panelu zębów"
        className={cn(
          "flex gap-2 overflow-x-auto py-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:py-2.5 [&::-webkit-scrollbar]:hidden",
          panelChromeInsetClass,
        )}
      >
        {TAB_ORDER.map((id) => {
          const selected = active === id;
          const count = id === "kolejka" && queueCount > 0 ? queueCount : undefined;
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
              id={`teeth-panel-tab-${id}`}
              aria-controls={`teeth-panel-view-${id}`}
              onClick={() => onChange(id)}
              onKeyDown={(e) => handleKeyDown(e, id)}
              className={cn(
                "flex min-h-11 shrink-0 items-center gap-2 rounded-md border px-3 py-2 transition sm:min-h-9 sm:py-1.5",
                panelTypography.tab,
                selected ? tabSelectedClass : panelTabIdleClass,
              )}
            >
              {TAB_LABELS[id]}
              {count !== undefined ? (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 tabular-nums",
                    panelTypography.tabBadge,
                    selected ? tabBadgeSelectedClass : "bg-slate-100 text-slate-700",
                  )}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {hint ? (
        <p
          className={cn(
            panelTypography.caption,
            "border-t border-indigo-100/60 bg-slate-50/50 px-3 py-2.5 text-slate-600 sm:px-4 lg:px-5",
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
