"use client";

import Link from "next/link";
import { HelpPopover, GuideIcon } from "@/components/ui/HelpPopover";
import { HowItWorksContent } from "@/components/summary/HowItWorks";
import { AppBrandFooterLine } from "@/components/layout/AppBrandContentFooter";
import { useOperationsUpdates } from "@/components/operations/OperationsUpdatesContext";
import { useSyncRelativeTime } from "@/hooks/useSyncRelativeTime";
import {
  panelContentFooterClass,
  panelContentFooterLinkClass,
  panelTypography,
} from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";

/** Lekka stopka na dole karty panelu — linki, sync i marka po scrollu listy. */
export function DailyPanelContentFooter() {
  const ctx = useOperationsUpdates();
  const syncLabel = useSyncRelativeTime(
    ctx?.lastSyncedAt ?? null,
    ctx?.lastPollAt ?? null
  );

  return (
    <footer className={panelContentFooterClass} aria-label="Stopka panelu dziennego">
      <nav
        aria-label="Skróty panelu dziennego"
        className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2"
      >
        <Link
          href="/lokalizacje/POLSKA"
          className={panelContentFooterLinkClass}
          title="Harmonogram i legenda kolorów terminów (PL / ZA / Import)"
        >
          Terminy
        </Link>
        <Link href="/zakupy/tablica" className={panelContentFooterLinkClass}>
          Tablica
        </Link>
        <HelpPopover
          label="Pomoc — panel dzienny"
          title="Panel dzienny"
          shortLabel="Pomoc"
          icon={<GuideIcon />}
          align="right"
          buttonClassName={cn(
            panelContentFooterLinkClass,
            "inline-flex items-center gap-1 border-0 bg-transparent p-0 shadow-none hover:bg-transparent"
          )}
        >
          <HowItWorksContent />
        </HelpPopover>
      </nav>

      <div className="mt-3 space-y-1 text-center">
        {ctx ? (
          <p className={panelTypography.caption}>
            Synchronizacja · {syncLabel}
          </p>
        ) : null}
        <AppBrandFooterLine />
      </div>
    </footer>
  );
}
