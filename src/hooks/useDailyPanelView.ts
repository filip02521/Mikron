"use client";

import { useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  parseDailyPanelView,
  type DailyPanelView,
} from "@/lib/orders/daily-panel-view";

/** Synchronizacja zakładki panelu z `?view=` i legacy hash `#dzis` / `#plan`. */
export function useDailyPanelView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = parseDailyPanelView(searchParams.get("view"));

  const setView = useCallback(
    (next: DailyPanelView) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", next);
      router.replace(`/podsumowanie?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash === "plan") {
      setView("tydzien");
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    } else if (hash === "dzis") {
      setView("dzis");
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    } else if (hash === "poza-harmonogramem") {
      setView("wyjatki");
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}?view=wyjatki#poza-harmonogramem`
      );
    }
  }, [setView]);

  return { view, setView };
}
