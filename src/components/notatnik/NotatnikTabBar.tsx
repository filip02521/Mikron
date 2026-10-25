"use client";

import type { NotatnikPageTab } from "@/lib/sales/notepad-page-tabs";
import { cn } from "@/lib/cn";
import { controlFocusClass } from "@/lib/ui/ontime-theme";

const TAB_META: Record<NotatnikPageTab, { label: string; title: string }> = {
  zk: {
    label: "ZK",
    title: "Zamówienia klientów czekające na towar",
  },
  notes: {
    label: "Notatki",
    title: "Prywatne przypomnienia handlowca",
  },
  archive: {
    label: "Archiwum",
    title: "Archiwum",
  },
};

const ARCHIVE_TAB_META: Record<"zk" | "notes", { label: string; title: string }> = {
  zk: {
    label: "Archiwum",
    title: "Zamknięte sprawy ZK",
  },
  notes: {
    label: "Archiwum",
    title: "Zarchiwizowane notatki",
  },
};

/** Zakładki strony z podkreśleniem — ten sam wygląd co `SectionTabNav` (DESIGN.md → Navigation). */
const TAB_CLASS = cn(
  "-mb-px inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 border-b-2 px-0.5 text-sm font-medium transition-colors duration-150 sm:min-h-10",
  controlFocusClass
);

export function NotatnikTabBar({
  value,
  onChange,
  zkCount,
  notesCount,
  archiveCount,
  showArchive,
  visibleTabs,
  archiveScope = "all",
  className,
}: {
  value: NotatnikPageTab;
  onChange: (tab: NotatnikPageTab) => void;
  zkCount: number;
  notesCount: number;
  archiveCount: number;
  showArchive: boolean;
  visibleTabs?: NotatnikPageTab[];
  /** Kontekst archiwum — etykiety na /zk vs /notatnik. */
  archiveScope?: "zk" | "notes" | "all";
  className?: string;
}) {
  const allTabs: NotatnikPageTab[] = showArchive ? ["zk", "notes", "archive"] : ["zk", "notes"];
  const tabs = visibleTabs?.length
    ? visibleTabs.filter((tab) => tab !== "archive" || showArchive)
    : allTabs;
  const counts: Record<NotatnikPageTab, number> = {
    zk: zkCount,
    notes: notesCount,
    archive: archiveCount,
  };
  const activeMeta =
    value === "archive" && archiveScope !== "all"
      ? ARCHIVE_TAB_META[archiveScope]
      : TAB_META[value];

  return (
    <>
      <div
        className={cn(
          "flex gap-5 overflow-x-auto border-b border-slate-200 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-6",
          className
        )}
        role="tablist"
        aria-label={visibleTabs?.includes("zk") === false ? "Sekcje notatnika" : "Sekcje ZK czekające"}
      >
        {tabs.map((tab) => {
          const active = value === tab;
          const count = counts[tab];
          const meta =
            tab === "archive" && archiveScope !== "all"
              ? ARCHIVE_TAB_META[archiveScope]
              : TAB_META[tab];
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={active}
              title={meta.title}
              onClick={() => onChange(tab)}
              className={cn(
                TAB_CLASS,
                active
                  ? "border-indigo-600 text-slate-900"
                  : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
              )}
            >
              <span>{meta.label}</span>
              {count > 0 ? (
                <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[0.625rem] font-semibold tabular-nums text-slate-600">
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        Aktywna sekcja: {activeMeta.label}
        {activeMeta.title !== activeMeta.label ? ` - ${activeMeta.title}` : ""}
      </p>
    </>
  );
}
