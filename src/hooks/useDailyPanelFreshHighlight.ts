"use client";

import { useEffect, useState } from "react";
import { useOperationsUpdates } from "@/components/operations/OperationsUpdatesContext";

/** Aktywny przez kilka sekund po odświeżeniu panelu — podświetla nieprzeczytane prośby. */
export function useDailyPanelFreshHighlight(): boolean {
  const ops = useOperationsUpdates();
  const until = ops?.freshHighlightUntil ?? 0;
  const generation = ops?.refreshGeneration ?? 0;
  const [now, setNow] = useState(() =>
    typeof window !== "undefined" ? Date.now() : 0
  );

  useEffect(() => {
    if (!ops) return;
    const interval = window.setInterval(() => setNow(Date.now()), 200);
    const timeout =
      until > Date.now()
        ? window.setTimeout(() => setNow(Date.now()), until - Date.now() + 50)
        : undefined;
    return () => {
      window.clearInterval(interval);
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [ops, until, generation]);

  return Boolean(ops && until > now);
}
