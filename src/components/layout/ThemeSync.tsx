"use client";

import { useEffect } from "react";
import { THEME_COOKIE, normalizeTheme, type ThemePreference } from "@/lib/auth/theme";
import { SYSTEM_DARK_QUERY, applyTheme, persistTheme } from "@/lib/ui/theme-client";

/**
 * Motyw z konta → <html>, cookie i localStorage (zmiana na innym urządzeniu wygrywa po odświeżeniu).
 * „Jak w systemie” słucha zmian systemu; inna karta przełącza się przez zdarzenie storage.
 * Bez sesji (ekran logowania) nic nie robi, żeby nie nadpisać wyboru.
 */
export function ThemeSync({ theme }: { theme?: ThemePreference }) {
  useEffect(() => {
    if (!theme) return;
    persistTheme(theme);
    applyTheme(theme);

    const media = window.matchMedia(SYSTEM_DARK_QUERY);
    const onSystem = () => {
      if (theme === "system") applyTheme("system");
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_COOKIE && e.newValue) applyTheme(normalizeTheme(e.newValue));
    };
    media.addEventListener("change", onSystem);
    window.addEventListener("storage", onStorage);
    return () => {
      media.removeEventListener("change", onSystem);
      window.removeEventListener("storage", onStorage);
    };
  }, [theme]);

  return null;
}
