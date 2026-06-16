"use client";

import type { NotatnikPageTab } from "@/lib/sales/notepad-page-tabs";
import { cn } from "@/lib/cn";
import {
  panelChoiceChipClass,
  panelChoiceChipIdleClass,
  panelChoiceChipSelectedClass,
  salesChromeInsetClass,
  tabBadgeSelectedClass,
} from "@/lib/ui/ontime-theme";

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

const TAB_CHIP_CLASS = cn(
  panelChoiceChipClass,
  "inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 py-2 sm:min-h-9"
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
          "flex flex-wrap gap-2 border-b border-slate-100 bg-slate-50/60 py-2.5",
          salesChromeInsetClass,
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
                TAB_CHIP_CLASS,
                active ? panelChoiceChipSelectedClass : panelChoiceChipIdleClass
              )}
            >
              <span>{meta.label}</span>
              {count > 0 ? (
                <span
                  className={cn(
                    "inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                    active ? tabBadgeSelectedClass : "bg-slate-200/90 text-slate-700"
                  )}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        Aktywna sekcja: {activeMeta.label}
        {activeMeta.title !== activeMeta.label ? ` — ${activeMeta.title}` : ""}
      </p>
    </>
  );
}
