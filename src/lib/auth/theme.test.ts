/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_COOKIE, THEME_SCRIPT, buildThemeCookie, normalizeTheme, resolveTheme } from "./theme";
import { applyTheme, getThemePreference, persistTheme, setThemePreference, subscribeThemePreference } from "@/lib/ui/theme-client";

function mockSystemDark(dark: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: dark && q.includes("dark"), addEventListener() {}, removeEventListener() {} }));
}
const runScript = () => new Function(THEME_SCRIPT)();
const html = () => document.documentElement;

beforeEach(() => {
  document.cookie = `${THEME_COOKIE}=; max-age=0; path=/`;
  localStorage.clear();
  html().removeAttribute("data-theme");
  html().style.colorScheme = "";
  html().className = "";
  mockSystemDark(false);
});
afterEach(() => vi.unstubAllGlobals());

describe("normalizeTheme / resolveTheme", () => {
  it("brak lub zła wartość = jasny (D2)", () => {
    expect(normalizeTheme(undefined)).toBe("light");
    expect(normalizeTheme("blue")).toBe("light");
    expect(normalizeTheme("system")).toBe("system");
  });
  it("„Jak w systemie” idzie za systemem", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
  it("cookie czytelne dla skryptu (nie httpOnly), na całą aplikację", () => {
    expect(buildThemeCookie("dark")).toMatchObject({ name: THEME_COOKIE, value: "dark", httpOnly: false, path: "/" });
  });
});

describe("skrypt w <head>", () => {
  it("cookie z konta ustawia ciemny przed pierwszym malowaniem", () => {
    document.cookie = `${THEME_COOKIE}=dark; path=/`;
    runScript();
    expect(html().getAttribute("data-theme")).toBe("dark");
    expect(html().style.colorScheme).toBe("dark");
  });
  it("bez cookie bierze localStorage; „system” pyta przeglądarkę", () => {
    localStorage.setItem(THEME_COOKIE, "system");
    mockSystemDark(true);
    runScript();
    expect(html().getAttribute("data-theme")).toBe("dark");
  });
  it("bez żadnego zapisu jasny, także przy ciemnym systemie (D2)", () => {
    mockSystemDark(true);
    runScript();
    expect(html().getAttribute("data-theme")).toBe("light");
  });
  it("cookie wygrywa z localStorage (zmiana na innym urządzeniu przychodzi przez logowanie)", () => {
    document.cookie = `${THEME_COOKIE}=light; path=/`;
    localStorage.setItem(THEME_COOKIE, "dark");
    runScript();
    expect(html().getAttribute("data-theme")).toBe("light");
  });
});

describe("applyTheme / persistTheme", () => {
  it("przełącza bez przejść CSS i zdejmuje blokadę po dwóch klatkach", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => (frames.push(cb), frames.length));
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);

    expect(applyTheme("dark")).toBe("dark");
    expect(html().getAttribute("data-theme")).toBe("dark");
    expect(html().classList.contains("theme-switching")).toBe(true);
    expect(meta.getAttribute("content")).toBe("#161a20");
    frames.shift()!(0);
    frames.shift()!(0);
    expect(html().classList.contains("theme-switching")).toBe(false);
    meta.remove();
  });
  it("ten sam motyw nie blokuje przejść drugi raz", () => {
    html().setAttribute("data-theme", "light");
    applyTheme("light");
    expect(html().classList.contains("theme-switching")).toBe(false);
  });
  it("wspólny stan powiadamia tylko przy zmianie", () => {
    const seen: (string | null)[] = [];
    const off = subscribeThemePreference(() => seen.push(getThemePreference()));
    setThemePreference("dark");
    setThemePreference("dark");
    setThemePreference("system");
    off();
    setThemePreference("light");
    expect(seen).toEqual(["dark", "system"]);
  });
  it("zapis trafia do cookie i localStorage pod tą samą nazwą", () => {
    persistTheme("system");
    expect(document.cookie).toContain(`${THEME_COOKIE}=system`);
    expect(localStorage.getItem(THEME_COOKIE)).toBe("system");
  });
});
