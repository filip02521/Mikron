"use client";

import { useCallback, useEffect, useRef } from "react";

/** Odwrotność krzywej wjazdu (0.22, 1, 0.36, 1) — panel wraca tą samą drogą, którą przyjechał. */
const EXIT_EASING = "cubic-bezier(0.64, 0, 0.78, 0)";
const EXIT_MS = 220;

/**
 * Zamknięcie panelu bocznego z animacją wyjazdu w prawo (symetrycznie do `panel-slide-enter`).
 * Startuje z bieżącej pozycji na ekranie, więc zamknięcie w trakcie wjazdu nie skacze.
 * `onClose` rodzica wywołuje dopiero po animacji; przy „ogranicz ruch” — od razu.
 */
export function useAnimatedClose(onClose: () => void) {
  const panelRef = useRef<HTMLElement | null>(null);
  const backdropRef = useRef<HTMLElement | null>(null);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    const panel = panelRef.current;
    if (
      !panel ||
      typeof panel.animate !== "function" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      onCloseRef.current();
      return;
    }
    closingRef.current = true;
    const backdrop = backdropRef.current;
    const fromTransform = getComputedStyle(panel).transform;
    const fromOpacity = backdrop ? getComputedStyle(backdrop).opacity : "1";
    panel.getAnimations().forEach((a) => a.cancel());
    backdrop?.getAnimations().forEach((a) => a.cancel());
    const timing = { duration: EXIT_MS, easing: EXIT_EASING, fill: "forwards" as const };
    const anim = panel.animate(
      [
        { transform: fromTransform === "none" ? "translateX(0)" : fromTransform },
        { transform: "translateX(100%)" },
      ],
      timing
    );
    backdrop?.animate([{ opacity: fromOpacity }, { opacity: 0 }], timing);
    const done = () => {
      if (!closingRef.current) return;
      closingRef.current = false;
      onCloseRef.current();
    };
    anim.onfinish = done;
    // Karta w tle wstrzymuje animacje — zamknięcie nie może od tego zależeć.
    window.setTimeout(done, EXIT_MS + 150);
  }, []);

  return { panelRef, backdropRef, requestClose };
}
