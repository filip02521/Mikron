"use client";

import { useEffect, useState } from "react";
import { useOperationsUpdates } from "@/components/operations/OperationsUpdatesContext";
import { useClientHydrated } from "@/lib/client/use-client-hydrated";

/** Aktywny przez kilka sekund po odświeżeniu panelu — podświetla nieprzeczytane prośby. */
export function useDailyPanelFreshHighlight(): boolean {
  const ops = useOperationsUpdates();
  const hydrated = useClientHydrated();
  const until = ops?.freshHighlightUntil ?? 0;
  const generation = ops?.refreshGeneration ?? 0;
  const hasOps = ops != null;
  const [now, setNow] = useState(0);

  // Zależność od samych wartości — obiekt kontekstu jest nowy przy każdym odpytaniu (co 25 s).
  useEffect(() => {
    if (!hydrated || !hasOps) return;
    const raf = requestAnimationFrame(() => setNow(Date.now()));
    const timeout =
      until > Date.now()
        ? window.setTimeout(() => setNow(Date.now()), until - Date.now() + 50)
        : undefined;
    return () => {
      cancelAnimationFrame(raf);
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [hydrated, hasOps, until, generation]);

  return Boolean(hydrated && ops && until > now);
}
