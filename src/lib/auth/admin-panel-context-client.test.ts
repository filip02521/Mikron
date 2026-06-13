import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { readAdminPanelContextFromDocument } from "@/lib/auth/admin-panel-context-client";

describe("readAdminPanelContextFromDocument", () => {
  beforeEach(() => {
    vi.stubGlobal("document", { cookie: "" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("odczytuje kontekst panelu admina z cookie", () => {
    vi.stubGlobal("document", {
      cookie: "ontime_admin_panel=magazyn; other=1",
    });

    expect(readAdminPanelContextFromDocument()).toBe("magazyn");
  });

  it("zwraca null dla nieznanego kontekstu", () => {
    vi.stubGlobal("document", {
      cookie: "ontime_admin_panel=unknown",
    });

    expect(readAdminPanelContextFromDocument()).toBeNull();
  });
});
