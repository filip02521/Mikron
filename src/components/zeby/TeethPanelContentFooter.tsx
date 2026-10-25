"use client";

import Link from "next/link";
import { AppBrandFooterLine } from "@/components/layout/AppBrandContentFooter";
import { useTeethUpdates } from "@/components/zeby/TeethUpdatesContext";
import { useSyncRelativeTime } from "@/hooks/useSyncRelativeTime";
import { teethSupplierCardsHref } from "@/lib/teeth/teeth-supplier-dual-lane";
import {
  panelContentFooterClass,
  panelContentFooterLinkClass,
  panelTypography,
} from "@/lib/ui/ontime-theme";

/** Stopka panelu zębów — skrót do kart dostawców, sync i marka po scrollu listy. Pomoc jest przy tytule. */
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
        <Link href={teethSupplierCardsHref()} className={panelContentFooterLinkClass}>
          Karty dostawców
        </Link>
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
