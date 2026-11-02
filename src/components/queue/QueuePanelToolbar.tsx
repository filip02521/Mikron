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
 * Zakładki widoku magazynu jako kafle z licznikiem: liczba to pierwsze, co magazyn chce wiedzieć
 * (ile czeka na przyjęcie, ile wpisów, co na regale). Przełączają widok w miejscu (hash), bez nawigacji.
 */
export function QueuePanelToolbar({
  view,
  onViewChange,
  counts,
  hints,
}: {
  view: QueueView;
  onViewChange: (view: QueueView) => void;
  counts: Record<QueueView, number>;
  /** Jedna linia pod nazwą kafla, np. „1 na regale do odbioru · 0 informacji”. */
  hints?: Partial<Record<QueueView, string>>;
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
      className="mb-4 grid grid-cols-3 gap-2 sm:gap-3"
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
              "flex min-w-0 flex-col items-start rounded-lg border bg-card px-3 py-2.5 text-left shadow-sm transition-colors duration-150 sm:px-4 sm:py-3",
              controlFocusClass,
              active
                ? "border-indigo-600 ring-1 ring-inset ring-indigo-600"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            )}
          >
            <span className="text-2xl font-semibold leading-none tabular-nums text-slate-900 sm:text-[1.75rem]">{count}</span>
            <span className={cn("mt-1.5 text-sm font-semibold", active ? "text-indigo-800" : "text-slate-800")}>
              {tab.label}
            </span>
            {hints?.[tab.id] ? (
              <span className="mt-0.5 hidden w-full truncate text-[0.8125rem] text-slate-500 sm:block">{hints[tab.id]}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
