/** Motyw interfejsu — wspólne dla serwera i klienta (docs/plans/ciemny-tryb.md §6). */

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_ORDER: ThemePreference[] = ["light", "dark", "system"];

export const THEME_LABELS: Record<ThemePreference, string> = {
  light: "Jasny",
  dark: "Ciemny",
  system: "Jak w systemie",
};

/** Cookie (czyta skrypt w <head>) i klucz localStorage mają tę samą nazwę. */
export const THEME_COOKIE = "ontime_theme";
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Kolor paska przeglądarki na telefonie = tło nagłówka (karta). */
export const THEME_COLOR: Record<ResolvedTheme, string> = { light: "#ffffff", dark: "#161a20" };

/** Brak wyboru = jasny (decyzja D2: domyślny jasny do końca przeglądu modułów). */
export function normalizeTheme(value: unknown): ThemePreference {
  return value === "dark" || value === "system" ? value : "light";
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  return preference === "dark" || (preference === "system" && systemPrefersDark) ? "dark" : "light";
}

/** Nie httpOnly: czyta go skrypt przed pierwszym malowaniem. */
export function buildThemeCookie(theme: ThemePreference) {
  return {
    name: THEME_COOKIE,
    value: theme,
    httpOnly: false,
    secure: false,
    sameSite: "lax" as const,
    path: "/",
    maxAge: THEME_COOKIE_MAX_AGE,
  };
}

/** Inline w <head>: data-theme i color-scheme na <html> z cookie / localStorage, zanim cokolwiek się narysuje. */
export const THEME_SCRIPT = `(function(){try{var d=document.documentElement,m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark|system)(?:;|$)/),p=m?m[1]:null;if(!p){try{p=localStorage.getItem("${THEME_COOKIE}")}catch(e){}}var t=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light";d.setAttribute("data-theme",t);d.style.colorScheme=t;}catch(e){}})();`;
