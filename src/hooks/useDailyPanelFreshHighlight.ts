"use client";

import { useEffect, useState } from "react";
import { useOperationsUpdates } from "@/components/operations/OperationsUpdatesContext";

/** Aktywny przez kilka sekund po odświeżeniu panelu — podświetla nieprzeczytane prośby. */
export function useDailyPanelFreshHighlight(): boolean {
  const ops = useOperationsUpdates();
  const until = ops?.freshHighlightUntil ?? 0;
  const generation = ops?.refreshGeneration ?? 0;
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!ops || until <= Date.now()) {
      setActive(false);
      return;
    }

    setActive(true);
    const timeout = window.setTimeout(() => setActive(false), until - Date.now());
    return () => window.clearTimeout(timeout);
  }, [ops, until, generation]);

  return active;
}
