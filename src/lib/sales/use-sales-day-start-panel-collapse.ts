"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "sales-day-start-panel-collapsed";

/** Zwijanie panelu po ogarnięciu zadań — pamiętane w sesji przeglądarki. */
export function useSalesDayStartPanelCollapse(hasOpenTasks: boolean) {
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    try {
      setCollapsedState(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* private mode */
    }
  }, []);

  useEffect(() => {
    if (hasOpenTasks) setCollapsedState(false);
  }, [hasOpenTasks]);

  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next);
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, "1");
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const effectiveCollapsed = hasOpenTasks ? false : collapsed;

  return { collapsed: effectiveCollapsed, setCollapsed, toggleCollapsed: () => setCollapsed(!effectiveCollapsed) };
}
