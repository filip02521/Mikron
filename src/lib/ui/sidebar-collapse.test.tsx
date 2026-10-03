/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { setSidebarCollapsed, useSidebarCollapsed, useSidebarCollapseShortcut } from "./sidebar-collapse";
import { SIDEBAR_COLLAPSE_SCRIPT, SIDEBAR_COLLAPSED_STORAGE_KEY } from "./sidebar-collapse-script";

function Probe() {
  const [collapsed, toggle] = useSidebarCollapsed();
  useSidebarCollapseShortcut();
  return (
    <div>
      <span data-testid="state">{collapsed ? "zwinięte" : "rozwinięte"}</span>
      <button type="button" onClick={toggle}>
        przełącz
      </button>
      <input aria-label="pole" />
    </div>
  );
}

describe("zwijane menu boczne", () => {
  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute("data-sidebar");
    localStorage.clear();
  });

  it("przełącznik zapisuje stan w <html> i localStorage", () => {
    render(<Probe />);
    expect(screen.getByTestId("state").textContent).toBe("rozwinięte");
    act(() => screen.getByRole("button", { name: "przełącz" }).click());
    expect(document.documentElement.getAttribute("data-sidebar")).toBe("collapsed");
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe("1");
    expect(screen.getByTestId("state").textContent).toBe("zwinięte");
    act(() => setSidebarCollapsed(false));
    expect(document.documentElement.hasAttribute("data-sidebar")).toBe(false);
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe("0");
  });

  it("skrót „[” działa poza polami tekstowymi", () => {
    render(<Probe />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "[" }));
    });
    expect(document.documentElement.getAttribute("data-sidebar")).toBe("collapsed");
    const input = screen.getByLabelText("pole");
    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "[", bubbles: true }));
    });
    expect(document.documentElement.getAttribute("data-sidebar")).toBe("collapsed");
  });

  it("skrypt w <head> odtwarza zwinięte menu przed renderem", () => {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, "1");
    new Function(SIDEBAR_COLLAPSE_SCRIPT)();
    expect(document.documentElement.getAttribute("data-sidebar")).toBe("collapsed");
  });
});
