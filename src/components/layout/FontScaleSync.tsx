"use client";

import { useEffect } from "react";
import type { FontScale } from "@/lib/auth/profile";

/**
 * Synchronizes data-font-scale attribute on <html> with the server-side
 * session value. Also persists to localStorage for FOUC-free next load.
 */
export function FontScaleSync({ fontScale }: { fontScale: FontScale }) {
  useEffect(() => {
    const html = document.documentElement;
    if (fontScale === "default") {
      html.removeAttribute("data-font-scale");
    } else {
      html.setAttribute("data-font-scale", fontScale);
    }
    try {
      if (fontScale === "default") {
        localStorage.removeItem("fontScale");
      } else {
        localStorage.setItem("fontScale", fontScale);
      }
    } catch {
      // ignore
    }
  }, [fontScale]);

  return null;
}
