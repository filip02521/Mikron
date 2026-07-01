"use client";

import Link from "next/link";
import { HelpPopover, GuideIcon } from "@/components/ui/HelpPopover";
import { AppBrandFooterLine } from "@/components/layout/AppBrandContentFooter";
import { TeethPanelHowItWorksContent } from "@/components/zeby/TeethPanelHowItWorks";
import { useTeethUpdates } from "@/components/zeby/TeethUpdatesContext";
import { useSyncRelativeTime } from "@/hooks/useSyncRelativeTime";
import { teethSupplierCardsHref } from "@/lib/teeth/teeth-supplier-dual-lane";
import {
  panelContentFooterClass,
  panelContentFooterLinkClass,
  panelTypography,
} from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";

/** Stopka na dole karty panelu zębów — skróty, sync i marka po scrollu listy. */
export function TeethPanelContentFooter() {
  const ctx = useTeethUpdates();
  const syncLabel = useSyncRelativeTime(
    ctx?.lastSyncedAt ?? null,
    ctx?.lastPollAt ?? null,
  );

  return (
    <footer className={panelContentFooterClass} aria-label="Stopka panelu zębów">
      <nav
        aria-label="Skróty panelu zębów"
        className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2"
      >
        <Link href="/zeby/kolejka" className={panelContentFooterLinkClass}>
          Kolejka
        </Link>
        <Link href="/zeby/przyjecie" className={panelContentFooterLinkClass}>
          Przyjęcie
        </Link>
        <Link href="/zeby/historia" className={panelContentFooterLinkClass}>
          Historia
        </Link>
        <Link href={teethSupplierCardsHref()} className={panelContentFooterLinkClass}>
          Karty dostawców
        </Link>
        <Link href="/zakupy/tablica" className={panelContentFooterLinkClass}>
          Tablica
        </Link>
        <HelpPopover
          label="Pomoc — panel zębów"
          title="Panel zębów"
          shortLabel="Pomoc"
          icon={<GuideIcon />}
          align="right"
          buttonClassName={cn(
            panelContentFooterLinkClass,
            "inline-flex items-center gap-1 border-0 bg-transparent p-0 shadow-none hover:bg-transparent",
          )}
        >
          <TeethPanelHowItWorksContent />
        </HelpPopover>
      </nav>

      <div className="mt-3 space-y-1 text-center">
        {ctx ? (
          <p className={panelTypography.caption} aria-live="polite">
            {ctx.hasUpdates ? (
              <>
                Są nowe zmiany ·{" "}
                <button
                  type="button"
                  onClick={ctx.refreshNow}
                  className="font-medium text-indigo-700 underline decoration-indigo-300/80 underline-offset-2 hover:text-indigo-900"
                >
                  odśwież widok
                </button>
              </>
            ) : (
              <>Synchronizacja · {syncLabel}</>
            )}
          </p>
        ) : null}
        <AppBrandFooterLine />
      </div>
    </footer>
  );
}
