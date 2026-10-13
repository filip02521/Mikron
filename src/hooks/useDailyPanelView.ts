"use client";

import { useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  parseDailyPanelView,
  type DailyPanelView,
} from "@/lib/orders/daily-panel-view";

function panelPath(view: DailyPanelView, searchParams: URLSearchParams, hash = ""): string {
  const params = new URLSearchParams(searchParams.toString());
  params.set("view", view);
  const q = params.toString();
  return `/podsumowanie?${q}${hash}`;
}

/** Synchronizacja zakładki panelu z `?view=` i legacy hash `#dzis` / `#plan`. */
export function useDailyPanelView() {
  const searchParams = useSearchParams();
  const view = parseDailyPanelView(searchParams.get("view"));
  const legacyHashHandled = useRef(false);

  const setView = useCallback(
    (next: DailyPanelView) => {
      if (parseDailyPanelView(searchParams.get("view")) === next) return;
      // Widok czysto kliencki — replaceState aktualizuje useSearchParams bez ponownego renderu serwera.
      window.history.replaceState(null, "", panelPath(next, searchParams));
    },
    [searchParams]
  );

  useEffect(() => {
    if (legacyHashHandled.current) return;
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;

    legacyHashHandled.current = true;

    if (hash === "plan") {
      if (view !== "tydzien") {
        setView("tydzien");
      } else {
        window.history.replaceState(null, "", panelPath("tydzien", searchParams));
      }
      return;
    }

    if (hash === "dzis") {
      if (view !== "dzis") {
        setView("dzis");
      } else {
        window.history.replaceState(null, "", panelPath("dzis", searchParams));
      }
      return;
    }

    if (hash === "poza-harmonogramem" || hash === "narzedzia") {
      const anchorHash = hash === "poza-harmonogramem" ? "#poza-harmonogramem" : "";
      const targetPath = panelPath("wyjatki", searchParams, anchorHash);

      if (view !== "wyjatki") {
        window.history.replaceState(null, "", targetPath);
        return;
      }

      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (current !== targetPath) {
        window.history.replaceState(null, "", targetPath);
      }

      if (hash === "poza-harmonogramem") {
        requestAnimationFrame(() => {
          document.getElementById("poza-harmonogramem")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        });
      }
    }
  }, [view, setView, searchParams]);

  return { view, setView };
}
