import {
  THEME_COLOR,
  THEME_COOKIE,
  buildThemeCookie,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/auth/theme";

export const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

export function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia(SYSTEM_DARK_QUERY).matches;
}

/**
 * Ustawia motyw na <html> bez przejść CSS (inaczej każdy element z transition-colors
 * przez 150–200 ms przechodzi z jasnego w ciemny) i aktualizuje kolor paska przeglądarki.
 */
export function applyTheme(preference: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(preference, systemPrefersDark());
  const html = document.documentElement;
  if (html.getAttribute("data-theme") !== resolved) {
    html.classList.add("theme-switching");
    html.setAttribute("data-theme", resolved);
    html.style.colorScheme = resolved;
    // Dwie klatki: najpierw przeglądarka liczy nowe kolory, potem wracają przejścia.
    requestAnimationFrame(() => requestAnimationFrame(() => html.classList.remove("theme-switching")));
  }
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", THEME_COLOR[resolved]));
  return resolved;
}

/** Zapamiętuje wybór dla skryptu w <head> (cookie) i jako zapas (localStorage). */
export function persistTheme(preference: ThemePreference) {
  const c = buildThemeCookie(preference);
  document.cookie = `${c.name}=${c.value}; path=${c.path}; max-age=${c.maxAge}; samesite=${c.sameSite}`;
  try {
    localStorage.setItem(THEME_COOKIE, preference);
  } catch {
    // tryb prywatny — wystarczy cookie
  }
}
