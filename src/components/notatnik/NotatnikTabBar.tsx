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
    title: "Zamknięte ZK i zarchiwizowane notatki",
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
  className,
}: {
  value: NotatnikPageTab;
  onChange: (tab: NotatnikPageTab) => void;
  zkCount: number;
  notesCount: number;
  archiveCount: number;
  showArchive: boolean;
  className?: string;
}) {
  const tabs: NotatnikPageTab[] = showArchive ? ["zk", "notes", "archive"] : ["zk", "notes"];
  const counts: Record<NotatnikPageTab, number> = {
    zk: zkCount,
    notes: notesCount,
    archive: archiveCount,
  };

  return (
    <>
      <div
        className={cn(
          "flex flex-wrap gap-2 border-b border-slate-100 bg-slate-50/60 py-2.5",
          salesChromeInsetClass,
          className
        )}
        role="tablist"
        aria-label="Sekcje ZK czekające"
      >
        {tabs.map((tab) => {
          const active = value === tab;
          const count = counts[tab];
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={active}
              title={TAB_META[tab].title}
              onClick={() => onChange(tab)}
              className={cn(
                TAB_CHIP_CLASS,
                active ? panelChoiceChipSelectedClass : panelChoiceChipIdleClass
              )}
            >
              <span>{TAB_META[tab].label}</span>
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
        Aktywna sekcja: {TAB_META[value].label}
      </p>
    </>
  );
}
