"use client";

import { useSyncExternalStore } from "react";
import { actionSetTheme } from "@/app/actions/user-preferences";
import type { ThemePreference } from "@/lib/auth/theme";
import {
  applyTheme,
  getThemePreference,
  persistTheme,
  setThemePreference,
  subscribeThemePreference,
} from "@/lib/ui/theme-client";

/** Bieżący wybór; `null` bez sesji i przed pierwszym efektem ThemeSync (bez rozjazdu przy hydracji). */
export function useThemePreference(fallback?: ThemePreference): ThemePreference | null {
  const current = useSyncExternalStore(subscribeThemePreference, getThemePreference, () => null);
  return current ?? fallback ?? null;
}

/** Każdy przełącznik motywu: od razu na ekranie, potem zapis na koncie. */
export function chooseTheme(preference: ThemePreference) {
  setThemePreference(preference);
  persistTheme(preference);
  applyTheme(preference);
  void actionSetTheme(preference);
}
