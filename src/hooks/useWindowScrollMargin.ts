"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

/** Odległość od góry dokumentu do początku wirtualnej listy (dla useWindowVirtualizer). */
export function useWindowScrollMargin(
  anchorRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  /** Zmiana wymusza ponowny pomiar (np. filtry, zwinięte grupy). */
  layoutKey = "",
  getOffset?: (el: HTMLElement) => number
) {
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    if (!enabled) return;

    const measure = () => {
      const el = anchorRef.current;
      if (!el) return;
      const base = el.getBoundingClientRect().top + window.scrollY;
      setScrollMargin(getOffset ? getOffset(el) : base);
    };

    measure();

    const ro = new ResizeObserver(measure);
    if (anchorRef.current) ro.observe(anchorRef.current);

    const page = anchorRef.current?.closest("main") ?? document.body;
    ro.observe(page);

    window.addEventListener("resize", measure);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [anchorRef, enabled, layoutKey, getOffset]);

  return scrollMargin;
}
