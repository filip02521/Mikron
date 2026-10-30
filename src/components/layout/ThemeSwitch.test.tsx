/**
 * @vitest-environment happy-dom
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const saved = vi.hoisted(() => [] as string[]);
vi.mock("@/app/actions/user-preferences", () => ({
  actionSetTheme: async (theme: string) => {
    saved.push(theme);
    return { ok: true };
  },
}));

import { ThemeSwitch } from "./ThemeSwitch";
import { setThemePreference } from "@/lib/ui/theme-client";

beforeEach(() => {
  saved.length = 0;
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const pressed = (group: HTMLElement) =>
  [...group.querySelectorAll("button")].filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.textContent);

describe("ThemeSwitch", () => {
  it("bez sesji (pusty wspólny stan, brak zapasu) nic nie pokazuje", () => {
    const { container } = render(<ThemeSwitch variant="sheet" />);
    expect(container.innerHTML).toBe("");
  });

  it("wybór w jednym miejscu widać od razu w drugim i trafia na konto", () => {
    act(() => setThemePreference("light"));
    render(
      <>
        <div data-testid="settings">
          <ThemeSwitch variant="labelled" fallback="light" />
        </div>
        <div data-testid="sidebar">
          <ThemeSwitch variant="icons" />
        </div>
      </>
    );
    const settings = screen.getByTestId("settings");
    const sidebar = screen.getByTestId("sidebar");

    fireEvent.click(screen.getByRole("button", { name: "Ciemny motyw" }));

    expect(pressed(settings)).toEqual(["Ciemny"]);
    expect(pressed(sidebar)).toEqual(["Ciemny motyw"]);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(saved).toEqual(["dark"]);
  });

  it("zwinięte menu: przycisk nazywa bieżący motyw", () => {
    act(() => setThemePreference("system"));
    render(<ThemeSwitch variant="menu" />);
    expect(screen.getByRole("button", { name: "Motyw: Jak w systemie" })).toBeTruthy();
  });
});
