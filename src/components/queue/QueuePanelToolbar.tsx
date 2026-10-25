"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";
import { controlFocusClass } from "@/lib/ui/ontime-theme";

export type QueueView = "receive" | "journal" | "inventory";

const TABS: { id: QueueView; label: string; title: string }[] = [
  { id: "receive", label: "Przyjęcie", title: "Kolejka przyjęcia towaru u dostawcy" },
  { id: "journal", label: "Dziennik", title: "Dziennik dostaw: kurier, paczki, palety" },
  { id: "inventory", label: "Regał", title: "Inwentaryzacja: co czeka na odbiór" },
];

/**
 * Zakładki widoku magazynu — wygląd `SectionTabNav` (podkreślenie Petrol), ale przyciski,
 * bo widoki przełączają się w miejscu (hash), bez nawigacji.
 */
export function QueuePanelToolbar({
  view,
  onViewChange,
  counts,
}: {
  view: QueueView;
  onViewChange: (view: QueueView) => void;
  counts: Record<QueueView, number>;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  const focusTab = (index: number) => {
    const next = TABS[(index + TABS.length) % TABS.length]!;
    onViewChange(next.id);
    listRef.current?.querySelector<HTMLButtonElement>(`#queue-tab-${next.id}`)?.focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="Widok magazynu"
      className="mb-5 flex gap-5 overflow-x-auto border-b border-slate-200 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-6"
    >
      {TABS.map((tab, index) => {
        const active = view === tab.id;
        const count = counts[tab.id];
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`queue-tab-${tab.id}`}
            aria-selected={active}
            aria-controls={`queue-panel-${tab.id}`}
            tabIndex={active ? 0 : -1}
            title={tab.title}
            onClick={() => onViewChange(tab.id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                e.preventDefault();
                focusTab(index + 1);
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                focusTab(index - 1);
              }
            }}
            className={cn(
              "-mb-px inline-flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-0.5 text-sm font-medium transition-colors duration-150 sm:min-h-10",
              controlFocusClass,
              active
                ? "border-indigo-600 text-slate-900"
                : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
            )}
          >
            {tab.label}
            {count > 0 ? (
              <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[0.625rem] font-semibold tabular-nums text-slate-600">
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
