/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const runRedirect = vi.fn(async (fn: () => Promise<unknown>) => {
  await fn();
});

vi.mock("@/lib/client/server-action-redirect", () => ({
  runServerActionWithRedirect: (fn: () => Promise<unknown>) => runRedirect(fn),
}));

vi.mock("@/app/actions/admin-panel-context", () => ({
  actionSetAdminPanelContext: vi.fn(async () => undefined),
}));

import { actionSetAdminPanelContext } from "@/app/actions/admin-panel-context";
import { AdminPreviewDock } from "./AdminPreviewDock";

describe("AdminPreviewDock", () => {
  afterEach(() => {
    cleanup();
    runRedirect.mockClear();
    vi.mocked(actionSetAdminPanelContext).mockClear();
  });

  it("renderuje zwinięty pasek z labelem panelu", () => {
    render(<AdminPreviewDock panelContext="zakupy" />);
    expect(screen.getByRole("button", { name: /Podgląd: Zakupy/i })).toBeTruthy();
    expect(screen.queryByText(/Tryb tylko do odczytu/i)).toBeNull();
  });

  it("pokazuje imię handlowca w trybie sales", () => {
    render(
      <AdminPreviewDock panelContext="sales" previewSalesPersonName="Anna Kowalska" />
    );
    expect(
      screen.getByRole("button", { name: /Podgląd: Handlowiec · Anna Kowalska/i })
    ).toBeTruthy();
  });

  it("rozwija sheet z opisem i zwija Escape", () => {
    render(<AdminPreviewDock panelContext="magazyn" />);
    fireEvent.click(screen.getByRole("button", { name: /Podgląd: Magazyn/i }));
    expect(screen.getByText(/Podgląd panelu: Magazyn/i)).toBeTruthy();
    expect(screen.getByText(/Tryb tylko do odczytu/i)).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText(/Podgląd panelu: Magazyn/i)).toBeNull();
  });

  it("dla Zakupów nie twierdzi że to tylko odczyt", () => {
    render(<AdminPreviewDock panelContext="zakupy" />);
    fireEvent.click(screen.getByRole("button", { name: /Podgląd: Zakupy/i }));
    expect(screen.getByText(/możesz pracować jak w tym dziale/i)).toBeTruthy();
    expect(screen.queryByText(/^Tryb tylko do odczytu/i)).toBeNull();
  });

  it("CTA wraca do administracji", async () => {
    render(<AdminPreviewDock panelContext="zakupy_zeby" />);
    fireEvent.click(screen.getByRole("button", { name: /Podgląd: Zęby/i }));
    fireEvent.click(screen.getByRole("button", { name: /Wróć do administracji/i }));
    expect(runRedirect).toHaveBeenCalledTimes(1);
    expect(actionSetAdminPanelContext).toHaveBeenCalledWith("admin");
  });

  it("zwija po zmianie panelContext", () => {
    const { rerender } = render(<AdminPreviewDock panelContext="zakupy" />);
    fireEvent.click(screen.getByRole("button", { name: /Podgląd: Zakupy/i }));
    expect(screen.getByText("Podgląd panelu: Zakupy")).toBeTruthy();

    rerender(<AdminPreviewDock panelContext="magazyn" />);
    expect(screen.queryByText("Podgląd panelu: Zakupy")).toBeNull();
    expect(screen.getByRole("button", { name: /Podgląd: Magazyn/i })).toBeTruthy();
  });
});
