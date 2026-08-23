import { describe, expect, it } from "vitest";
import { activeAdminHubTab, resolveAdminHubTabs } from "./admin-hub";

describe("admin hub", () => {
  it("rozpoznaje aktywną zakładkę po ścieżce", () => {
    expect(activeAdminHubTab("/admin")).toBe("system");
    expect(activeAdminHubTab("/admin/uzytkownicy")).toBe("users");
    expect(activeAdminHubTab("/admin/handlowcy")).toBe("sales");
    expect(activeAdminHubTab("/admin/mail")).toBe("mail");
    expect(activeAdminHubTab("/admin/wysylki")).toBe("wysylki");
    expect(activeAdminHubTab("/admin/wysylki/abc")).toBe("wysylki");
  });

  it("modułu Ivoclar pokazuje tylko zakładkę mail", () => {
    expect(resolveAdminHubTabs(false)).toEqual(["mail"]);
    expect(resolveAdminHubTabs(true)).toContain("wysylki");
    expect(resolveAdminHubTabs(true)).toContain("system");
  });
});
