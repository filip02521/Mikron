/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/client/server-action-redirect", () => ({
  runServerActionWithRedirect: vi.fn(async (fn: () => Promise<unknown>) => {
    await fn();
  }),
}));

vi.mock("@/app/actions/admin-panel-context", () => ({
  actionSetAdminPanelContext: vi.fn(async () => undefined),
}));

import { actionSetAdminPanelContext } from "@/app/actions/admin-panel-context";
import { AdminPanelContextSwitcher } from "./AdminPanelContextSwitcher";

describe("AdminPanelContextSwitcher", () => {
  afterEach(() => {
    cleanup();
    vi.mocked(actionSetAdminPanelContext).mockClear();
  });

  it("domyślnie pokazuje tylko bieżący panel", () => {
    render(<AdminPanelContextSwitcher current="zakupy" />);
    expect(screen.getByRole("button", { expanded: false })).toBeTruthy();
    expect(screen.getByText("Zakupy")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Magazyn" })).toBeNull();
  });

  it("rozsuwa listę paneli i pozwala wybrać", () => {
    render(<AdminPanelContextSwitcher current="admin" />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByRole("button", { expanded: true })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Magazyn" }));
    expect(actionSetAdminPanelContext).toHaveBeenCalledWith("magazyn");
  });

  it("zwija Escape", () => {
    render(<AdminPanelContextSwitcher current="zakupy" />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByRole("button", { name: "Admin" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Admin" })).toBeNull();
  });

  it("zwija kliknięciem poza switcherem", () => {
    render(
      <div>
        <button type="button">Poza</button>
        <AdminPanelContextSwitcher current="zakupy" />
      </div>
    );
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByRole("button", { name: "Admin" })).toBeTruthy();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Poza" }));
    expect(screen.queryByRole("button", { name: "Admin" })).toBeNull();
  });
});
